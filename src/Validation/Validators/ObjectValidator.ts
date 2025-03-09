import { BadSchemaError, BadTypeError, SchemaValidationError } from "#/errors"
import type { Schema, TypeValidator, ConcreteSchema, ConcreteSchemaValue } from "../SchemaValidation"
import { ShorthandValidators } from "../ShorthandValidators"

function isTypeValidator<T>(validator: ConcreteSchema|TypeValidator<T>): validator is TypeValidator<T> {
    return 'validate' in validator && validator.validate instanceof Function
}

// TODO: not complete
function isConcreteSchema<T>(concreteSchema: unknown): concreteSchema is ConcreteSchema {
    return typeof concreteSchema === 'object'
}

function concreteSchemaValueToValidator(value: ConcreteSchemaValue): TypeValidator<unknown> {
    if(typeof value === 'string') {
        if(!(value in ShorthandValidators)) {
            throw new BadSchemaError(`unknown type "${value}" specified in concrete schema`)
        }
        return ShorthandValidators[value]
    } else if(Array.isArray(value)) {
        if(value.length !== 1) {
            throw new BadSchemaError(`array had length not equal to 1`)
        }
        return concreteSchemaValueToValidator(value[0])
    } else if(isTypeValidator(value)) {
        return value
    } else if(isConcreteSchema(value)) {
        return new ObjectValidator(value)
    } else {
        throw new BadSchemaError('illegal value provided in concrete schema - not a type string or validator')
    }
}

export const nullable = Symbol('whether an object-valued key is nullable')
export const optionalKeys = Symbol('whether keys marked as nullable are optional and default to null')

type UnknownObj = { [key: string]: unknown }

export class ObjectValidator<CS extends ConcreteSchema> implements TypeValidator<Schema<CS>> {
    constructor(
        private concreteSchema: CS,
        private parseStrings: boolean = false
    ) {}

    validate(params: unknown): [value: null, error: string] | [value: Schema<CS>, error: null] {
        if(this.parseStrings && typeof params === 'string') {
            try {
                params = JSON.parse(params)
            } catch(e) {
                return [null, `string value not a serialized JSON object`]
            }
        }

        if(typeof params !== 'object' || Array.isArray(params)) {
            throw new BadTypeError('object', typeof params)
        }

        if(params === null) {
            if(this.concreteSchema[nullable] === true) {
                return [ null as Schema<CS>, null ]
            } else {
                throw new BadTypeError('object', 'null') 
            }
        }
        
        const rawParams: UnknownObj = params as UnknownObj

        const parsedParams: Schema<CS> = {} as Schema<CS>

        for(const keyWithPossibleQuestionMark of Object.keys(this.concreteSchema) as Array<keyof ConcreteSchema & string>) {
            // need to remove question mark if key was marked optional
            const key = keyWithPossibleQuestionMark.replace(/\?$/, '')

            if(!key) {
                return [null, `empty schema property key names are illegal`]
            }

            if(!(key in params) || params[key as keyof typeof params] === undefined) {
                // Key was not present in object
                if(keyWithPossibleQuestionMark.endsWith('?')) {
                    // Key was optional, just continue
                    continue
                }

                if(!(optionalKeys in this.concreteSchema && this.concreteSchema[optionalKeys] === true)) {
                    // Object is not marked as "missing nullable keys default to null",
                    // so key was required. Raise error
                    return [null, `required parameter ${String(key)} not provided`]
                }
            }

            // Default to null if key not provided.
            // At this point, key is either defined (possibly null)
            // or missing but marked as "default to null".
            rawParams[key] ??= null

            const validator = concreteSchemaValueToValidator(this.concreteSchema[keyWithPossibleQuestionMark])

            try {
                const [value, error] = validator.validate(rawParams[key])

                if(error !== null) {
                    return [null, `error during validation of parameter ${key}: ${error}`]
                }

                (parsedParams as any)[key as keyof Schema<CS>] = value as any
            } catch(e) {
                if(e instanceof SchemaValidationError) {
                    throw new SchemaValidationError(`error in parameter "${key}": ${e.message}`)
                } else {
                    throw e
                }
            }
        }

        return [ parsedParams, null ]
    }
}
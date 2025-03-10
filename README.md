# object-schema-validation

Simple and straightforward library to validate objects against a provided schema at runtime with compile-time type safety

```ts
import { object } from 'object-schema-validation'

const untypedObject: unknown = JSON.parse(`
    {
        "profileId": "5ca28d8c-a909-4900-9ffb-afb14a28dbd3",
        "name": "Eva Williams",
        "age": 23,
        "bio": null,
        "comments": [
            {
                "text": "Easily parse objects with compile-time type safety!"
            },
            {
                "text": "Perfect for parsing API request bodies",
                "edits": [
                    {
                        "text": "Or providing intellisense hints for db data while enforcing expected schemas at runtime"
                    }
                ]
            }
        ]
    }
`)

const typedObject = object({
    profileId: 'uuid',
    name: 'string',
    age: 'int',
    bio: 'string?',
    comments: [{
        text: 'string',
        'edits?': [{
            text: 'string'
        }]
    }]
}).validate(untypedObject)

// typeof typedObject is {
//     profileId: `${string}-${string}-${string}-${string}-${string}`;
//     name: string;
//     age: number;
//     bio: string | null;
//     comments: {
//         text: string;
//         edits?: {
//             text: string;
//         }[];
//     }[];
// }

// typescript does not complain here
typedObject.name
typedObject.comments[1].edits?.[0].text
```

## Table of Contents

- [Install](#install)
- [Basic usage](#basic-usage)
- [Schema syntax](#schema-syntax)
    - [Strings](#strings)
        - [Basic strings](#basic-strings)
        - [Enforcing strings are non-empty](#enforcing-strings-are-non-empty)
        - [Trimming strings](#trimming-strings)
        - [Uuid strings](#uuids)
    - [Integers](#integers)
    - [Floating point numbers](#floating-point-numbers)
    - [Booleans](#booleans)
    - [Arrays](#arrays)
    - [Nullability](#nullability)
    - [Optionality](#optionality)
- [License](#license)

## Install

```
npm install object-schema-validation
```

## Basic usage

This project provides a number of *validators* for assorted data types. Validators are objects that contain a `validate()` function that accepts arbitrary data and returns the data in a strongly-typed form, sometimes modified, if the data is considered valid. For example, an integer validator can be obtained with `int()`, which returns the value passed to `validate()` if it is a javascript `number` primitive and a whole number:

```ts
import { int } from 'object-schema-validation'

// typeof typedInt is number
const typedInt = int().validate(parseInt('123') as unknown)
```

Validators throw a `SchemaValidationError` if the data passed to them is invalid:

```ts
// throws 'bad type; expected "number", got "string"'
const typedInt = int().validate('wow!')
```

The most important validator is `object()`, which accepts an object whose values are validators and can be used to verify the schema of an entire object:

```ts
import { object, string, int } from 'object-schema-validation'

const validator = object({
    name: string(),
    age: int(),
    address: {
        street: string(),
        city: string(),
        zip: int()
    }
})

// typeof typedObject is {
//     name: string;
//     age: number;
//     address: {
//         street: string;
//         city: string;
//         zip: number;
//     };
// }
const typedObject = validator.validate(
    JSON.parse(`{
        "name": "Jane Doe",
        "age": 21,
        "address": {
            "street": "1234 Alexander Ave",
            "city": "Gotham City",
            "zip": 12345
        }
    }`)
)
```

While you can explicitly specify the validator for each property, object-schema-validation also allows you to use shorthand type specifications in the form of strings in most circumstances. The above example can also be written like so:

```ts
const validator = object({
    name: 'string',
    age: 'int',
    address: {
        street: 'string',
        city: 'string',
        zip: 'int'
    }
})

const typedObject = validator.validate(
    JSON.parse(`{
        "name": "Jane Doe",
        "age": 21,
        "address": {
            "street": "1234 Alexander Ave",
            "city": "Gotham City",
            "zip": 12345
        }
    }`)
)
```

The specification for an object's structure passed to the `object()` call is called a *concrete schema*. It is concrete in that it exists at runtime rather than being erased like typescript's type system.

The typescript type of a valid object corresponding to a particular concrete schema can be obtained using `Schema<typeof concreteSchema>`. For example:

```ts
import { object, type Schema } from 'object-schema-validation'

const personSchema = {
    name: 'string',
    age: 'int',
    address: {
        street: 'string',
        city: 'string',
        zip: 'int'
    }
} as const

// equivalent to {
//     name: string;
//     age: number;
//     address: {
//         street: string;
//         city: string;
//         zip: number;
//     };
// }
type Person = Schema<typeof personSchema>

function printPersonDetails(person: Person) {
    console.log(`${person.name} lives in ${person.address.city}`)
}

const person = object(personSchema).validate(
    JSON.parse(`{
        "name": "Jane Doe",
        "age": 21,
        "address": {
            "street": "1234 Alexander Ave",
            "city": "Gotham City",
            "zip": 12345
        }
    }`)
)

printPersonDetails(person)
```

## Schema syntax

### Strings

#### Basic strings

Use `'string'` or `string()` to enforce an object key is a string:

```ts
import { object, string } from 'object-schema-validation'

// typeof typedObject is {
//     abc: string;
//     def: string;
// }
const typedObject = object({
    abc: 'string',
    def: string()
}).validate({
    abc: 'Hello',
    def: 'world'
})
```

#### Enforcing strings are non-empty

You can use the value `'non-empty string'` to enforce a string-valued object key is non-empty:

```ts
import { object } from 'object-schema-validation'

const validator = object({
    abc: 'non-empty string'
})

// typeof typedObject1 is {
//     abc: string;
// }
const typedObject1 = validator.validate({
    abc: 'Some string here'
})

// typeof typedObject2 is {
//     abc: string;
// }
//
// but will throw 'empty string is not accepted' at runtime
const typedObject2 = validator.validate({
    abc: ''
})
```

#### Trimming strings

You can use `'trimmed string'` or `'trimmed non-empty string'` to automatically trim whitespace from both ends of a string:

```ts
import { object, string } from 'object-schema-validation'

// typedObject1 is {
//     abc: 'Hello',
//     def: 'world'
// }
const typedObject1 = object({
    abc: 'trimmed string',
    def: 'trimmed string'
}).validate({
    abc: '   Hello   ',
    def: 'world'
})

// throws 'empty string is not accepted'
// because "def" is empty (after trimming)
const typedObject2 = object({
    abc: 'trimmed non-empty string',
    def: 'trimmed non-empty string'
}).validate({
    abc: '   Hello   ',
    def: '       '
})
```

#### Uuids

Use `'uuid'` or `uuid()` to enforce a string is a valid uuid:

```ts
import { object, uuid } from 'object-schema-validation'

// typeof typedObject is {
//     abc: `${string}-${string}-${string}-${string}-${string}`;
//     def: `${string}-${string}-${string}-${string}-${string}`;
// }
const typedObject = object({
    abc: 'uuid',
    def: uuid()
}).validate({
    abc: '5ca28d8c-a909-4900-9ffb-afb14a28dbd3',
    def: '114462d1-897d-460b-8f57-07d2f7970bc0'
})
```

The type of a uuid key is assignable to `string` but a little more specific using template literal types to capture the format of uuids.

### Integers

Use `'int'`, `integer` or `int()` to enforce an object key is an integer:

```ts
import { object, int } from 'object-schema-validation'

// typeof typedObject is {
//     abc: number;
//     def: number;
//     ghi: number;
// }
const typedObject = object({
    abc: 'int',
    def: 'integer',
    ghi: int()
}).validate({
    abc: 123,
    def: 456.0,
    ghi: -789
})
```

Strings containing integers are not accepted:

```ts
// throws 'bad type; expected "number", got "string"'
const typedObject = object({
    abc: 'int'
}).validate({
    abc: '123'
})
```

### Floating point numbers

Use `'float'` or `float()` to enforce an object key is a floating point number:

```ts
import { object, float } from 'object-schema-validation'

// typeof typedObject is {
//     abc: number;
//     def: number;
//     ghi: number;
// }
const typedObject = object({
    abc: 'float',
    def: 'float',
    ghi: float()
}).validate({
    abc: 123,
    def: 0.5,
    ghi: -100.75
})
```

Strings containing numbers are not accepted:

```ts
// throws 'bad type; expected "number", got "string"'
const typedObject = object({
    abc: 'float'
}).validate({
    abc: '123.456'
})
```

### Booleans

Use `'boolean'` or `bool()` to enforce an object key is a boolean:

```ts
import { object, bool } from 'object-schema-validation'

// typeof typedObject is {
//     abc: boolean;
//     def: boolean;
// }
const typedObject = object({
    abc: 'boolean',
    def: bool(),
}).validate({
    abc: true,
    def: false
})
```

### Arrays

Any of the string-based schema values can be made into arrays by appending `[]` after the type:

```ts
import { object } from 'object-schema-validation'

// typeof typedObject is {
//     abc: number[];
//     def: string[];
//     ghi: boolean[];
// }
const typedObject = object({
    abc: 'int[]',
    def: 'non-empty string[]',
    ghi: 'boolean[]'
}).validate({
    abc: [1, 2],
    def: ['abc', 'def'],
    ghi: [true, false]
})
```

Alternatively, you can wrap any validator or shorthand type string in an actual array (this only works one level deep):

```js
import { object, bool } from 'object-schema-validation'

// typeof typedObject is {
//     abc: number[];
//     def: string[];
//     ghi: boolean[];
// }
const typedObject = object({
    abc: [ 'int' ],
    def: [ 'non-empty string' ],
    ghi: [ bool() ]
}).validate({
    abc: [1, 2],
    def: ['abc', 'def'],
    ghi: [true, false]
})
```

Alternatively, you can use the `array()` function and pass it a validator that will be used for the component elements:

```js
import { object, array, int } from 'object-schema-validation'

// typeof typedObject is {
//     abc: number[];
// }
const typedObject = object({
    abc: array(int())
}).validate({
    abc: [1, 2]
})
```

`array()` validators can be nested to arbitrary depth:

```js
import { object, array, int } from 'object-schema-validation'

// typeof typedObject is {
//     abc: number[][][];
// }
const typedObject = object({
    abc: array(array(array(int())))
}).validate({
    abc: [[[1, 2], [3, 4]], [[5, 6]]]
})
```

### Nullability

Any of the string-based schema values can be marked nullable by adding a question mark after them:

```ts
import { object } from 'object-schema-validation'

// typeof typedObject is {
//     abc: number | null;
//     def: string | null;
//     ghi: boolean | null;
// }
const typedObject = object({
    abc: 'int?',
    def: 'non-empty string?',
    ghi: 'boolean?'
}).validate({
    abc: null,
    def: 'abc',
    ghi: false
})
```

Arrays can have only their elements marked as nullable by including the question mark before the square brackets, or the entire array-valued key itself can be marked nullable by including the question mark after the brackets:

```ts
import { object } from 'object-schema-validation'

// typeof typedObject is {
//     abc: (number | null)[];
//     def: number[] | null;
//     ghi: (number | null)[] | null;
// }
const typedObject = object({
    abc: 'int?[]',
    def: 'int[]?',
    ghi: 'int?[]?'
}).validate({
    abc: [1, null, 3],
    def: null,
    ghi: null
})
```

Object-valued keys can be marked nullable by importing the `nullable` symbol and setting it to true on the nullable object: 

```ts
import { object, nullable } from 'object-schema-validation'

const validator = object({
    someObject: {
        [nullable]: true,
        a: 'int',
        b: 'string'
    }
})

// typeof typedObject1 is {
//     someObject: {
//         a: number;
//         b: string; 
//     } | null;
// }
const typedObject1 = validator.validate({
    someObject: {
        a: 123,
        b: 'def'
    }
})

// typeof typedObject1 is {
//     someObject: {
//         a: number;
//         b: string; 
//     } | null;
// }
const typedObject2 = validator.validate({
    someObject: null
})
```

Alternatively, wrap any validator in a call to `maybe()` to make it nullable:

```ts
import { object, maybe, int } from 'object-schema-validation'

// typeof typedObject is {
//     abc: number | null;
// }
const typedObject = object({
    abc: maybe(int())
}).validate({
    abc: null
})
```

### Optionality

Keys whose names end in a question mark are optional. The question mark is not expected to be present in the key name at runtime:

```ts
import { object } from 'object-schema-validation'

const validator = object({
    'optionalString?': 'string',
    'optionalInt?': 'int'
})

// typeof typedObject1 is {
//     optionalString?: string;
//     optionalInt?: number;
// }
const typedObject1 = validator.validate({
    optionalString: 'String was provided'
})

// typeof typedObject2 is {
//     optionalString?: string;
//     optionalInt?: number;
// }
const typedObject2 = validator.validate({
    optionalInt: 123
})
```

## License

object-schema-validation is licensed under the MIT license.

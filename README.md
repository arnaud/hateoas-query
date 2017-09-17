# HATEOAS query

`HATEOAS-query` enables working with REST HATEOAS APIs while keeping a very concise and elegant code.

It encapsulates a DSL that helps write single-line selectors to query and fetch though the endpoints, where promises chaining would usually be the classic implementation.

For instance,

```js
const httpClient = require('my/http/client');
const path = _.get(user, '_links.invoices.href');
const invoices = await httpClient({ path })
_.get(invoices, 'items', []);
```

suddendly becomes:

```js
// const request = ...;
const query = require('hateoas-query')({ request });
const invoices = await query(user, `invoices[]`); // <==
```

## Table of Contents

- [Install](#install)
- [Usage](#usage)
- [Rules](#rules)
- [API](#api)
- [Contribute](#contribute)
- [License](#license)

## Install

This project uses [node](http://nodejs.org) and [npm](https://npmjs.com).
Go check them out if you don't have them locally installed.

```sh
$ npm i --save hateoas-query
```

## Usage

All you need is a starting node and a selector, then handle the response in an asynchronous way:

```js
const invoiceIds = await bquery(user, 'accounts[].invoices[].invoiceId')
console.log(invoiceIds);
// => [1005, 1006, 1008, 1009]
```

## Rules

`HATEOAS-query` relies on a specific set of selector rules:
- Each dot `'.'` marks a breakpoint in the chain, that distinguishes every path used to follow the HATOAS links from an endpoint to another ;
- When a path corresponds to a collection of `'.items[]'`, it must be marked with a trailing `'[]'` ; 
  > Examples: `'invoices[]'`, `'accounts[].invoices[]'`
- Each path element can either be a *link*, an *action* or an *attribute* ;
- A path which pattern is `'that'` will be considered a *link* (if available) or an *attribute* (if available) ; if it matches a *link*, it will follow `'_links.that.href'` ;
- A path which pattern is `'@that'` will be considered an *action* and will follow `'_actions.that'` ;
- Results are concatenated and reduced (see [functions](Functions)) ;
- Each result has a reference to its `'_origin'`, which keeps a cloned version of the previous node in the graph ;
- That's it.

## API

### Global options

Options can be defined when instanciating the library. These options will affect each and every subsequently calls.

```js
const query = hateoas({ request: customRequest }) // <==
```

#### `strict`

Type: `boolean` (default: `false`)

When enabled, strict mode ensures all goes well when traversing all the nodes and triggers errors that have to be catched by the callee.
When disabled, no errors are triggered but a warning is logged.

#### `request`

Type: `Promise` (default: `undefined`)

This option is **mandatory** ; it defines how to request a ressource. It should be a Promise-based API client such as `axios` for example.

### Options

#### `strict`

Type: `boolean` (default: `false`)

When enabled, strict mode ensures all goes well when traversing all the nodes and triggers errors that have to be catched by the callee.
When disabled, no errors are triggered but a warning is logged.

#### `actionParams`

Type: `object` (default: `{}`)

Set the action parameters that will be set when calling an actual action.

#### `only`

Type: `array or function` (default: `undefined`)

Creates an object composed of the picked properties.

### Functions

#### `query( node, selector [, options] [, results] )`

Traverse a HATEOAS REST API through a selector that descends the corresponding links in a HATEOAS compliant way.

Arguments:
- node: The root node from which the traversal begins with.
- selector: The [selector](#rules) is the "full path" that will be used to traverse the tree.
- options: [Options](#options).
- results: This is a reduced Array of every results coming from every leading nodes whichever their origin (whichever which they descend from in terms of tree traversal). Its format is `[arr]` where `arr` is the concatenated reduction of every results.

#### `query-isolated( node, selector [, options] [, results] )`

This function has all the same implementation as `query()` but its results are not reduced.
- results: This is a non-reduced Array of every results coming from every leading nodes whichever their origin (whichever which they descend from in terms of tree traversal). Its format is `[[arr1], [arr2], [...]]` where `arrN` is the result of its N-origin.

## Contribute

Feel free to dive in! [Open an issue](https://github.com/arnahd/hateoas-query/issues/new) or submit PRs.

## License

MIT (c) Arnaud Leymet

import extend from 'lodash-es/extend'
import get from 'lodash-es/get'
import has from 'lodash-es/has'
import keys from 'lodash-es/keys'
import pick from 'lodash-es/pick'
import pickBy from 'lodash-es/pickBy'
import values from 'lodash-es/values'
import find from 'lodash-es/find'
import filter from 'lodash-es/filter'
import map from 'lodash-es/map'
import reduce from 'lodash-es/reduce'
import isArray from 'lodash-es/isArray'

/**
 * Traverse a HATEOAS REST API through a selector that descends the corresponding links in a HATEOAS compliant way.
 *
 * Usage:
 * > query(user, `accounts[].invoices[]`)
 * >   .then(invoices => {
 * >     const invoiceAccountIds = invoices.map(({ id }) => id);
 * >   });
 *
 * @param {node}   node       The root node from which the traversal begins with.
 * @param {string} selector   The selector is the "full path" that will be used to traverse the tree.
 *                            - Each dot '.' marks a breakpoint in the chain, that distinguishes every path
 *                            used to follow the HATOAS links from an endpoint to another.
 *                            - When a path corresponds to a collection, it must be marked with a trailing '[]'.
 *                            Examples:
 *                            > 'factures[]'
 *                            > 'comptesFacturation[].factures[]'
 * @param {object} options    Options:
 *                            - actionParams
 *                            - only
 * @param {array}  results    This is a reduced Array of every results coming from every leading nodes
 *                            whichever their origin (whichever which they descend from in terms of tree traversal).
 *                            Its format is `[arr]` where `arr` is the concatenated reduction of every results.
 */
function query (node, selector, options, results = []) {
  options = extend({}, { request: this.request, strict: this.strict }, options)
  return queryIsolated(node, selector, options, results)
    .then(result => extended(concatReducer(result)))
}

/**
 * Traverse a HATEOAS REST API through a selector that descends the corresponding links in a HATEOAS compliant way.
 *
 * @param {node}   node       The root node from which the traversal begins with.
 * @param {string} selector   The selector is the "full path" that will be used to traverse the tree.
 * @param {object} options    Options:
 *                            - actionParams
 *                            - only
 * @param {array}  results    This is a non-reduced Array of every results coming from every leading nodes
 *                            whichever their origin (whichever which they descend from in terms of tree traversal).
 *                            Its format is `[[arr1], [arr2], [...]]` where `arrN` is the result of its N-origin.
 */
function queryIsolated (node, selector, options, results = []) {
  if (this) options = extend({}, { request: this.request, strict: this.strict }, options)
  if (!selector) {
    const only = get(options, 'only')
    if (!only) {
      return Promise.resolve(extended(node))
    } else if (Array.isArray(only)) {
      return Promise.resolve(pick(extended(node), only))
    } else {
      return Promise.resolve(pickBy(extended(node), only))
    }
  }
  const links = selector.split('.')
  const path = links.shift()
  const isIterable = isSelectorIterable(path)
  const isAction = isSelectorAnAction(path)
  const remainingSelector = links.join('.')
  let requestOptions
  let actionParams
  if (isAction) {
    requestOptions = getAction(node, path)
    actionParams = get(options, 'actionParams')
  } else {
    requestOptions = { path: getLink(node, path) }
  }

  const handleResponse = (response) => {
    const responseIsIterable = isArray(response);
    if (!isIterable && !responseIsIterable) {
      return queryIsolated(response, remainingSelector, options, results);
    } else {
      let { items } = response;
      if (responseIsIterable) items = response;
      const filteredItems = isSelectorFiltered(path) ? items[getSelectorFilter(path)] : items;
      const promises = filteredItems.map(item => {
        return queryIsolated(item, remainingSelector, options, results)
          .then(response => extend(response, { _origin: node }));
      });
      return Promise.all(promises);
    }
  };
  
  if (!(requestOptions.path || requestOptions.action)) {
    // if neither a _link or an _action, check if it matches an attribute
    const item = getAttribute(node, path)
    if (item !== undefined) {
      results.unshift(item) // stack the responses in reverse order
      return handleResponse(item);
    } else {
      const error = `Could not traverse \`${selector}\``
      if (get(options, 'strict')) {
        throw new Error(`[Strict mode] ${error}`)
      } else {
        return Promise.resolve(undefined)
      }
    }
  }

  return options.request(
    extend({}, requestOptions, { params: actionParams })
  )
    .then(response => {
      results.unshift(response) // FIXME: stack the responses in reverse order
      return handleResponse(response)
        .then(response => extended(response));
    })
    .catch(error => {
      throw error
    })
}

/**
 * Extends an object or collection with lodash methods for easier.
 * @param {*} obj
 */
function extended (obj) {
  if (typeof obj !== 'object') return obj
  // chainable queries
  obj.query = (...args) => query(obj, ...args)
  obj.queryIsolated = (...args) => queryIsolated(obj, ...args)
  const isArray = Array.isArray(obj)
  // object
  if (!isArray) {
    obj.get = (...args) => extended(get(obj, ...args))
    obj.has = (...args) => extended(has(obj, ...args))
    obj.keys = (...args) => extended(keys(obj, ...args))
    obj.values = (...args) => extended(values(obj, ...args))
  }
  // collection
  if (isArray) {
    obj.find = (...args) => extended(find(obj, ...args))
    obj.map = (...args) => extended(map(obj, ...args))
    obj.filter = (...args) => extended(filter(obj, ...args))
    obj.reduce = (...args) => reduce(obj, ...args)
  }
  return obj
}

const getLink = (node, path) => get(node, `_links.${path.replace(/\[\d*]$/, '')}.href`)
const getAction = (node, path) => get(node, `_actions.${path.replace(/^@/, '')}`, {})
const getAttribute = (node, path) => get(node, path.replace(/\[\d*]$/, ''))

const isSelectorIterable = selector => /\[\d*]$/.test(selector)
const isSelectorFiltered = selector => /\[\d+]$/.test(selector)
const isSelectorAnAction = selector => /^@/.test(selector)
const getSelectorFilter = selector => {
  const n = selector.match(/\[(\d*)]/)[1]

  return isNaN(n) ? false : parseInt(n)
}

function concatReducer (collection) {
  if (collection && Array.isArray(collection[0])) {
    return reduce(collection, (accumulator, current) =>
      accumulator && current ? accumulator.concat(current) : accumulator || [current]
    )
  } else {
    return collection
  }
}

// Create the default instance to be exported
const instance = ({ request, strict }) => query.bind({ request, strict })

// Expose some functions
instance.query = ({ request, strict }) => query.bind({ request, strict })
instance.isolated = ({ request, strict }) => queryIsolated.bind({ request, strict })
instance.concatReducer = concatReducer
instance.extended = extended

export default instance

import * as _ from 'lodash'
// import * as log from 'loglevel'

/**
 * Traverse a HATEOAS REST API through a selector that descends the corresponding links in a HATEOAS compliant way.
 *
 * Usage:
 * > query(user, `accounts[].invoices[]`)
 * >   .then(invoices => {
 * >     const invoiceAccountIds = invoices.map(({ id }) => id);
 * >     log.debug('Invoice accounts:', invoiceAccountIds);
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
async function query (node, selector, options, results = []) {
  options = _.extend({}, { request: this.request, strict: this.strict }, options)
  return extended(concatReducer(await queryIsolated(node, selector, options, results)))
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
async function queryIsolated (node, selector, options, results = []) {
  options = _.extend({}, { request: this.request, strict: this.strict }, options)
  if (!selector) {
    const only = _.get(options, 'only')
    if (!only) {
      return extended(node)
    } else if (_.isArray(only)) {
      return _.pick(extended(node), only)
    } else {
      return _.pickBy(extended(node), only)
    }
  }
  // log.debug(`"${selector}"`, { node })
  const links = selector.split('.')
  const path = links.shift()
  const isIterable = isSelectorIterable(path)
  const isAction = isSelectorAnAction(path)
  const remainingSelector = links.join('.')
  let requestOptions
  let actionParams
  if (isAction) {
    requestOptions = getAction(node, path)
    actionParams = _.get(options, 'actionParams')
  } else {
    requestOptions = { path: getLink(node, path) }
  }

  if (!(requestOptions.path || requestOptions.action)) {
    // if neither a _link or an _action, check if it matches an attribute
    const item = getAttribute(node, path)
    if (item !== undefined) {
      results.unshift(item) // stack the responses in reverse order

      let response = await queryIsolated(item, remainingSelector, options, results)
      return extended(_.extend(response, { _origin: node }))
    } else {
      const error = `Could not traverse \`${selector}\``
      if (_.get(options, 'strict')) {
        throw new Error(`[Strict mode] ${error}`)
      } else {
        // log.warn(error, { node })
        return undefined
      }
    }
  }

  let response = await options.request(
    _.extend({}, requestOptions, { params: actionParams })
  )
  results.unshift(response) // FIXME: stack the responses in reverse order
  if (!isIterable) {
    response = await queryIsolated(response, remainingSelector, options, results)
    return response
  } else {
    const { items } = response
    const filteredItems = isSelectorFiltered(path) ? items[getSelectorFilter(path)] : items
    const responses = await Promise.all(filteredItems.map(async item => {
      const res = await queryIsolated(item, remainingSelector, options, results)
      return _.extend(res, { _origin: node })
    }))
    return extended(responses)
  }
/*
    })
    .catch(error => {
      log.error(requestOptions, error, { node })
      throw error
    })
*/
}

/**
 * Extends an object or collection with lodash methods for easier.
 * @param {*} obj 
 */
function extended (obj) {
  const isArray = _.isArray(obj)
  obj.query = (...args) => query(obj, ...args)
  obj.queryIsolated = (...args) => queryIsolated(obj, ...args)
  // object
  if (!isArray) {
    obj.get = (...args) => extended(_.get(obj, ...args))
    obj.has = (...args) => extended(_.has(obj, ...args))
    obj.keys = (...args) => extended(_.keys(obj, ...args))
    obj.values = (...args) => extended(_.values(obj, ...args))
  }
  // collection
  if (isArray) {
    obj.find = (...args) => extended(_.find(obj, ...args))
    obj.map = (...args) => extended(_.map(obj, ...args))
    obj.filter = (...args) => extended(_.filter(obj, ...args))
    obj.reduce = (...args) => extended(_.reduce(obj, ...args))
  }
  return obj
}

const getLink = (node, path) => _.get(node, `_links.${path.replace(/\[\d*]$/, '')}.href`)
const getAction = (node, path) => _.get(node, `_actions.${path.replace(/^@/, '')}`, {})
const getAttribute = (node, path) => _.get(node, path)

const isSelectorIterable = selector => /\[\d*]$/.test(selector)
const isSelectorFiltered = selector => /\[\d+]$/.test(selector)
const isSelectorAnAction = selector => /^@/.test(selector)
const getSelectorFilter = selector => {
  const n = selector.match(/\[(\d*)]/)[1]

  return isNaN(n) ? false : parseInt(n)
}

function concatReducer (collection) {
  if (collection && _.isArray(collection[0])) {
    return _.reduce(collection, (accumulator, current) => {
      return accumulator && current ? accumulator.concat(current) : accumulator || [current]
    })
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

module.exports = instance

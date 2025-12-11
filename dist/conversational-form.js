(function (root) {

  // Store setTimeout reference so promise-polyfill will be unaffected by
  // other code modifying setTimeout (like sinon.useFakeTimers())
  var setTimeoutFunc = setTimeout;

  function noop() {}
  
  // Polyfill for Function.prototype.bind
  function bind(fn, thisArg) {
    return function () {
      fn.apply(thisArg, arguments);
    };
  }

  function Promise(fn) {
    if (typeof this !== 'object') throw new TypeError('Promises must be constructed via new');
    if (typeof fn !== 'function') throw new TypeError('not a function');
    this._state = 0;
    this._handled = false;
    this._value = undefined;
    this._deferreds = [];

    doResolve(fn, this);
  }

  function handle(self, deferred) {
    while (self._state === 3) {
      self = self._value;
    }
    if (self._state === 0) {
      self._deferreds.push(deferred);
      return;
    }
    self._handled = true;
    Promise._immediateFn(function () {
      var cb = self._state === 1 ? deferred.onFulfilled : deferred.onRejected;
      if (cb === null) {
        (self._state === 1 ? resolve : reject)(deferred.promise, self._value);
        return;
      }
      var ret;
      try {
        ret = cb(self._value);
      } catch (e) {
        reject(deferred.promise, e);
        return;
      }
      resolve(deferred.promise, ret);
    });
  }

  function resolve(self, newValue) {
    try {
      // Promise Resolution Procedure: https://github.com/promises-aplus/promises-spec#the-promise-resolution-procedure
      if (newValue === self) throw new TypeError('A promise cannot be resolved with itself.');
      if (newValue && (typeof newValue === 'object' || typeof newValue === 'function')) {
        var then = newValue.then;
        if (newValue instanceof Promise) {
          self._state = 3;
          self._value = newValue;
          finale(self);
          return;
        } else if (typeof then === 'function') {
          doResolve(bind(then, newValue), self);
          return;
        }
      }
      self._state = 1;
      self._value = newValue;
      finale(self);
    } catch (e) {
      reject(self, e);
    }
  }

  function reject(self, newValue) {
    self._state = 2;
    self._value = newValue;
    finale(self);
  }

  function finale(self) {
    if (self._state === 2 && self._deferreds.length === 0) {
      Promise._immediateFn(function() {
        if (!self._handled) {
          Promise._unhandledRejectionFn(self._value);
        }
      });
    }

    for (var i = 0, len = self._deferreds.length; i < len; i++) {
      handle(self, self._deferreds[i]);
    }
    self._deferreds = null;
  }

  function Handler(onFulfilled, onRejected, promise) {
    this.onFulfilled = typeof onFulfilled === 'function' ? onFulfilled : null;
    this.onRejected = typeof onRejected === 'function' ? onRejected : null;
    this.promise = promise;
  }

  /**
   * Take a potentially misbehaving resolver function and make sure
   * onFulfilled and onRejected are only called once.
   *
   * Makes no guarantees about asynchrony.
   */
  function doResolve(fn, self) {
    var done = false;
    try {
      fn(function (value) {
        if (done) return;
        done = true;
        resolve(self, value);
      }, function (reason) {
        if (done) return;
        done = true;
        reject(self, reason);
      });
    } catch (ex) {
      if (done) return;
      done = true;
      reject(self, ex);
    }
  }

  Promise.prototype['catch'] = function (onRejected) {
    return this.then(null, onRejected);
  };

  Promise.prototype.then = function (onFulfilled, onRejected) {
    var prom = new (this.constructor)(noop);

    handle(this, new Handler(onFulfilled, onRejected, prom));
    return prom;
  };

  Promise.all = function (arr) {
    var args = Array.prototype.slice.call(arr);

    return new Promise(function (resolve, reject) {
      if (args.length === 0) return resolve([]);
      var remaining = args.length;

      function res(i, val) {
        try {
          if (val && (typeof val === 'object' || typeof val === 'function')) {
            var then = val.then;
            if (typeof then === 'function') {
              then.call(val, function (val) {
                res(i, val);
              }, reject);
              return;
            }
          }
          args[i] = val;
          if (--remaining === 0) {
            resolve(args);
          }
        } catch (ex) {
          reject(ex);
        }
      }

      for (var i = 0; i < args.length; i++) {
        res(i, args[i]);
      }
    });
  };

  Promise.resolve = function (value) {
    if (value && typeof value === 'object' && value.constructor === Promise) {
      return value;
    }

    return new Promise(function (resolve) {
      resolve(value);
    });
  };

  Promise.reject = function (value) {
    return new Promise(function (resolve, reject) {
      reject(value);
    });
  };

  Promise.race = function (values) {
    return new Promise(function (resolve, reject) {
      for (var i = 0, len = values.length; i < len; i++) {
        values[i].then(resolve, reject);
      }
    });
  };

  // Use polyfill for setImmediate for performance gains
  Promise._immediateFn = (typeof setImmediate === 'function' && function (fn) { setImmediate(fn); }) ||
    function (fn) {
      setTimeoutFunc(fn, 0);
    };

  Promise._unhandledRejectionFn = function _unhandledRejectionFn(err) {
    if (typeof console !== 'undefined' && console) {
      console.warn('Possible Unhandled Promise Rejection:', err); // eslint-disable-line no-console
    }
  };

  /**
   * Set the immediate function to execute callbacks
   * @param fn {function} Function to execute
   * @deprecated
   */
  Promise._setImmediateFn = function _setImmediateFn(fn) {
    Promise._immediateFn = fn;
  };

  /**
   * Change the function to execute on unhandled rejection
   * @param {function} fn Function to execute on unhandled rejection
   * @deprecated
   */
  Promise._setUnhandledRejectionFn = function _setUnhandledRejectionFn(fn) {
    Promise._unhandledRejectionFn = fn;
  };
  
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = Promise;
  } else if (!root.Promise) {
    root.Promise = Promise;
  }

})(this);

// Polyfill for creating CustomEvents on IE9/10/11

// code pulled from:
// https://github.com/d4tocchini/customevent-polyfill
// https://developer.mozilla.org/en-US/docs/Web/API/CustomEvent#Polyfill

try {
    var ce = new window.CustomEvent('test');
    ce.preventDefault();
    if (ce.defaultPrevented !== true) {
        // IE has problems with .preventDefault() on custom events
        // http://stackoverflow.com/questions/23349191
        throw new Error('Could not prevent default');
    }
} catch(e) {
  var CustomEvent = function(event, params) {
    var evt, origPrevent;
    params = params || {
      bubbles: false,
      cancelable: false,
      detail: undefined
    };

    evt = document.createEvent("CustomEvent");
    evt.initCustomEvent(event, params.bubbles, params.cancelable, params.detail);
    origPrevent = evt.preventDefault;
    evt.preventDefault = function () {
      origPrevent.call(this);
      try {
        Object.defineProperty(this, 'defaultPrevented', {
          get: function () {
            return true;
          }
        });
      } catch(e) {
        this.defaultPrevented = true;
      }
    };
    return evt;
  };

  CustomEvent.prototype = window.Event.prototype;
  window.CustomEvent = CustomEvent; // expose definition to window
}

(function(f){if(typeof exports==="object"&&typeof module!=="undefined"){module.exports=f()}else if(typeof define==="function"&&define.amd){define([],f)}else{var g;if(typeof window!=="undefined"){g=window}else if(typeof global!=="undefined"){g=global}else if(typeof self!=="undefined"){g=self}else{g=this}g.FastFuzzy = f()}})(function(){var define,module,exports;return (function(){function r(e,n,t){function o(i,f){if(!n[i]){if(!e[i]){var c="function"==typeof require&&require;if(!f&&c)return c(i,!0);if(u)return u(i,!0);var a=new Error("Cannot find module '"+i+"'");throw a.code="MODULE_NOT_FOUND",a}var p=n[i]={exports:{}};e[i][0].call(p.exports,function(r){var n=e[i][1][r];return o(n||r)},p,p.exports,r,e,n,t)}return n[i].exports}for(var u="function"==typeof require&&require,i=0;i<t.length;i++)o(t[i]);return o}return r})()({1:[function(require,module,exports){
'use strict'

exports.byteLength = byteLength
exports.toByteArray = toByteArray
exports.fromByteArray = fromByteArray

var lookup = []
var revLookup = []
var Arr = typeof Uint8Array !== 'undefined' ? Uint8Array : Array

var code = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'
for (var i = 0, len = code.length; i < len; ++i) {
  lookup[i] = code[i]
  revLookup[code.charCodeAt(i)] = i
}

// Support decoding URL-safe base64 strings, as Node.js does.
// See: https://en.wikipedia.org/wiki/Base64#URL_applications
revLookup['-'.charCodeAt(0)] = 62
revLookup['_'.charCodeAt(0)] = 63

function getLens (b64) {
  var len = b64.length

  if (len % 4 > 0) {
    throw new Error('Invalid string. Length must be a multiple of 4')
  }

  // Trim off extra bytes after placeholder bytes are found
  // See: https://github.com/beatgammit/base64-js/issues/42
  var validLen = b64.indexOf('=')
  if (validLen === -1) validLen = len

  var placeHoldersLen = validLen === len
    ? 0
    : 4 - (validLen % 4)

  return [validLen, placeHoldersLen]
}

// base64 is 4/3 + up to two characters of the original data
function byteLength (b64) {
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function _byteLength (b64, validLen, placeHoldersLen) {
  return ((validLen + placeHoldersLen) * 3 / 4) - placeHoldersLen
}

function toByteArray (b64) {
  var tmp
  var lens = getLens(b64)
  var validLen = lens[0]
  var placeHoldersLen = lens[1]

  var arr = new Arr(_byteLength(b64, validLen, placeHoldersLen))

  var curByte = 0

  // if there are placeholders, only get up to the last complete 4 chars
  var len = placeHoldersLen > 0
    ? validLen - 4
    : validLen

  var i
  for (i = 0; i < len; i += 4) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 18) |
      (revLookup[b64.charCodeAt(i + 1)] << 12) |
      (revLookup[b64.charCodeAt(i + 2)] << 6) |
      revLookup[b64.charCodeAt(i + 3)]
    arr[curByte++] = (tmp >> 16) & 0xFF
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 2) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 2) |
      (revLookup[b64.charCodeAt(i + 1)] >> 4)
    arr[curByte++] = tmp & 0xFF
  }

  if (placeHoldersLen === 1) {
    tmp =
      (revLookup[b64.charCodeAt(i)] << 10) |
      (revLookup[b64.charCodeAt(i + 1)] << 4) |
      (revLookup[b64.charCodeAt(i + 2)] >> 2)
    arr[curByte++] = (tmp >> 8) & 0xFF
    arr[curByte++] = tmp & 0xFF
  }

  return arr
}

function tripletToBase64 (num) {
  return lookup[num >> 18 & 0x3F] +
    lookup[num >> 12 & 0x3F] +
    lookup[num >> 6 & 0x3F] +
    lookup[num & 0x3F]
}

function encodeChunk (uint8, start, end) {
  var tmp
  var output = []
  for (var i = start; i < end; i += 3) {
    tmp =
      ((uint8[i] << 16) & 0xFF0000) +
      ((uint8[i + 1] << 8) & 0xFF00) +
      (uint8[i + 2] & 0xFF)
    output.push(tripletToBase64(tmp))
  }
  return output.join('')
}

function fromByteArray (uint8) {
  var tmp
  var len = uint8.length
  var extraBytes = len % 3 // if we have 1 byte left, pad 2 bytes
  var parts = []
  var maxChunkLength = 16383 // must be multiple of 3

  // go through the array every three bytes, we'll deal with trailing stuff later
  for (var i = 0, len2 = len - extraBytes; i < len2; i += maxChunkLength) {
    parts.push(encodeChunk(uint8, i, (i + maxChunkLength) > len2 ? len2 : (i + maxChunkLength)))
  }

  // pad the end with zeros, but make sure to not forget the extra bytes
  if (extraBytes === 1) {
    tmp = uint8[len - 1]
    parts.push(
      lookup[tmp >> 2] +
      lookup[(tmp << 4) & 0x3F] +
      '=='
    )
  } else if (extraBytes === 2) {
    tmp = (uint8[len - 2] << 8) + uint8[len - 1]
    parts.push(
      lookup[tmp >> 10] +
      lookup[(tmp >> 4) & 0x3F] +
      lookup[(tmp << 2) & 0x3F] +
      '='
    )
  }

  return parts.join('')
}

},{}],2:[function(require,module,exports){
(function (Buffer){(function (){
/*!
 * The buffer module from node.js, for the browser.
 *
 * @author   Feross Aboukhadijeh <https://feross.org>
 * @license  MIT
 */
/* eslint-disable no-proto */

'use strict'

var base64 = require('base64-js')
var ieee754 = require('ieee754')

exports.Buffer = Buffer
exports.SlowBuffer = SlowBuffer
exports.INSPECT_MAX_BYTES = 50

var K_MAX_LENGTH = 0x7fffffff
exports.kMaxLength = K_MAX_LENGTH

/**
 * If `Buffer.TYPED_ARRAY_SUPPORT`:
 *   === true    Use Uint8Array implementation (fastest)
 *   === false   Print warning and recommend using `buffer` v4.x which has an Object
 *               implementation (most compatible, even IE6)
 *
 * Browsers that support typed arrays are IE 10+, Firefox 4+, Chrome 7+, Safari 5.1+,
 * Opera 11.6+, iOS 4.2+.
 *
 * We report that the browser does not support typed arrays if the are not subclassable
 * using __proto__. Firefox 4-29 lacks support for adding new properties to `Uint8Array`
 * (See: https://bugzilla.mozilla.org/show_bug.cgi?id=695438). IE 10 lacks support
 * for __proto__ and has a buggy typed array implementation.
 */
Buffer.TYPED_ARRAY_SUPPORT = typedArraySupport()

if (!Buffer.TYPED_ARRAY_SUPPORT && typeof console !== 'undefined' &&
    typeof console.error === 'function') {
  console.error(
    'This browser lacks typed array (Uint8Array) support which is required by ' +
    '`buffer` v5.x. Use `buffer` v4.x if you require old browser support.'
  )
}

function typedArraySupport () {
  // Can typed array instances can be augmented?
  try {
    var arr = new Uint8Array(1)
    arr.__proto__ = { __proto__: Uint8Array.prototype, foo: function () { return 42 } }
    return arr.foo() === 42
  } catch (e) {
    return false
  }
}

Object.defineProperty(Buffer.prototype, 'parent', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.buffer
  }
})

Object.defineProperty(Buffer.prototype, 'offset', {
  enumerable: true,
  get: function () {
    if (!Buffer.isBuffer(this)) return undefined
    return this.byteOffset
  }
})

function createBuffer (length) {
  if (length > K_MAX_LENGTH) {
    throw new RangeError('The value "' + length + '" is invalid for option "size"')
  }
  // Return an augmented `Uint8Array` instance
  var buf = new Uint8Array(length)
  buf.__proto__ = Buffer.prototype
  return buf
}

/**
 * The Buffer constructor returns instances of `Uint8Array` that have their
 * prototype changed to `Buffer.prototype`. Furthermore, `Buffer` is a subclass of
 * `Uint8Array`, so the returned instances will have all the node `Buffer` methods
 * and the `Uint8Array` methods. Square bracket notation works as expected -- it
 * returns a single octet.
 *
 * The `Uint8Array` prototype remains unmodified.
 */

function Buffer (arg, encodingOrOffset, length) {
  // Common case.
  if (typeof arg === 'number') {
    if (typeof encodingOrOffset === 'string') {
      throw new TypeError(
        'The "string" argument must be of type string. Received type number'
      )
    }
    return allocUnsafe(arg)
  }
  return from(arg, encodingOrOffset, length)
}

// Fix subarray() in ES2016. See: https://github.com/feross/buffer/pull/97
if (typeof Symbol !== 'undefined' && Symbol.species != null &&
    Buffer[Symbol.species] === Buffer) {
  Object.defineProperty(Buffer, Symbol.species, {
    value: null,
    configurable: true,
    enumerable: false,
    writable: false
  })
}

Buffer.poolSize = 8192 // not used by this implementation

function from (value, encodingOrOffset, length) {
  if (typeof value === 'string') {
    return fromString(value, encodingOrOffset)
  }

  if (ArrayBuffer.isView(value)) {
    return fromArrayLike(value)
  }

  if (value == null) {
    throw TypeError(
      'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
      'or Array-like Object. Received type ' + (typeof value)
    )
  }

  if (isInstance(value, ArrayBuffer) ||
      (value && isInstance(value.buffer, ArrayBuffer))) {
    return fromArrayBuffer(value, encodingOrOffset, length)
  }

  if (typeof value === 'number') {
    throw new TypeError(
      'The "value" argument must not be of type number. Received type number'
    )
  }

  var valueOf = value.valueOf && value.valueOf()
  if (valueOf != null && valueOf !== value) {
    return Buffer.from(valueOf, encodingOrOffset, length)
  }

  var b = fromObject(value)
  if (b) return b

  if (typeof Symbol !== 'undefined' && Symbol.toPrimitive != null &&
      typeof value[Symbol.toPrimitive] === 'function') {
    return Buffer.from(
      value[Symbol.toPrimitive]('string'), encodingOrOffset, length
    )
  }

  throw new TypeError(
    'The first argument must be one of type string, Buffer, ArrayBuffer, Array, ' +
    'or Array-like Object. Received type ' + (typeof value)
  )
}

/**
 * Functionally equivalent to Buffer(arg, encoding) but throws a TypeError
 * if value is a number.
 * Buffer.from(str[, encoding])
 * Buffer.from(array)
 * Buffer.from(buffer)
 * Buffer.from(arrayBuffer[, byteOffset[, length]])
 **/
Buffer.from = function (value, encodingOrOffset, length) {
  return from(value, encodingOrOffset, length)
}

// Note: Change prototype *after* Buffer.from is defined to workaround Chrome bug:
// https://github.com/feross/buffer/pull/148
Buffer.prototype.__proto__ = Uint8Array.prototype
Buffer.__proto__ = Uint8Array

function assertSize (size) {
  if (typeof size !== 'number') {
    throw new TypeError('"size" argument must be of type number')
  } else if (size < 0) {
    throw new RangeError('The value "' + size + '" is invalid for option "size"')
  }
}

function alloc (size, fill, encoding) {
  assertSize(size)
  if (size <= 0) {
    return createBuffer(size)
  }
  if (fill !== undefined) {
    // Only pay attention to encoding if it's a string. This
    // prevents accidentally sending in a number that would
    // be interpretted as a start offset.
    return typeof encoding === 'string'
      ? createBuffer(size).fill(fill, encoding)
      : createBuffer(size).fill(fill)
  }
  return createBuffer(size)
}

/**
 * Creates a new filled Buffer instance.
 * alloc(size[, fill[, encoding]])
 **/
Buffer.alloc = function (size, fill, encoding) {
  return alloc(size, fill, encoding)
}

function allocUnsafe (size) {
  assertSize(size)
  return createBuffer(size < 0 ? 0 : checked(size) | 0)
}

/**
 * Equivalent to Buffer(num), by default creates a non-zero-filled Buffer instance.
 * */
Buffer.allocUnsafe = function (size) {
  return allocUnsafe(size)
}
/**
 * Equivalent to SlowBuffer(num), by default creates a non-zero-filled Buffer instance.
 */
Buffer.allocUnsafeSlow = function (size) {
  return allocUnsafe(size)
}

function fromString (string, encoding) {
  if (typeof encoding !== 'string' || encoding === '') {
    encoding = 'utf8'
  }

  if (!Buffer.isEncoding(encoding)) {
    throw new TypeError('Unknown encoding: ' + encoding)
  }

  var length = byteLength(string, encoding) | 0
  var buf = createBuffer(length)

  var actual = buf.write(string, encoding)

  if (actual !== length) {
    // Writing a hex string, for example, that contains invalid characters will
    // cause everything after the first invalid character to be ignored. (e.g.
    // 'abxxcd' will be treated as 'ab')
    buf = buf.slice(0, actual)
  }

  return buf
}

function fromArrayLike (array) {
  var length = array.length < 0 ? 0 : checked(array.length) | 0
  var buf = createBuffer(length)
  for (var i = 0; i < length; i += 1) {
    buf[i] = array[i] & 255
  }
  return buf
}

function fromArrayBuffer (array, byteOffset, length) {
  if (byteOffset < 0 || array.byteLength < byteOffset) {
    throw new RangeError('"offset" is outside of buffer bounds')
  }

  if (array.byteLength < byteOffset + (length || 0)) {
    throw new RangeError('"length" is outside of buffer bounds')
  }

  var buf
  if (byteOffset === undefined && length === undefined) {
    buf = new Uint8Array(array)
  } else if (length === undefined) {
    buf = new Uint8Array(array, byteOffset)
  } else {
    buf = new Uint8Array(array, byteOffset, length)
  }

  // Return an augmented `Uint8Array` instance
  buf.__proto__ = Buffer.prototype
  return buf
}

function fromObject (obj) {
  if (Buffer.isBuffer(obj)) {
    var len = checked(obj.length) | 0
    var buf = createBuffer(len)

    if (buf.length === 0) {
      return buf
    }

    obj.copy(buf, 0, 0, len)
    return buf
  }

  if (obj.length !== undefined) {
    if (typeof obj.length !== 'number' || numberIsNaN(obj.length)) {
      return createBuffer(0)
    }
    return fromArrayLike(obj)
  }

  if (obj.type === 'Buffer' && Array.isArray(obj.data)) {
    return fromArrayLike(obj.data)
  }
}

function checked (length) {
  // Note: cannot use `length < K_MAX_LENGTH` here because that fails when
  // length is NaN (which is otherwise coerced to zero.)
  if (length >= K_MAX_LENGTH) {
    throw new RangeError('Attempt to allocate Buffer larger than maximum ' +
                         'size: 0x' + K_MAX_LENGTH.toString(16) + ' bytes')
  }
  return length | 0
}

function SlowBuffer (length) {
  if (+length != length) { // eslint-disable-line eqeqeq
    length = 0
  }
  return Buffer.alloc(+length)
}

Buffer.isBuffer = function isBuffer (b) {
  return b != null && b._isBuffer === true &&
    b !== Buffer.prototype // so Buffer.isBuffer(Buffer.prototype) will be false
}

Buffer.compare = function compare (a, b) {
  if (isInstance(a, Uint8Array)) a = Buffer.from(a, a.offset, a.byteLength)
  if (isInstance(b, Uint8Array)) b = Buffer.from(b, b.offset, b.byteLength)
  if (!Buffer.isBuffer(a) || !Buffer.isBuffer(b)) {
    throw new TypeError(
      'The "buf1", "buf2" arguments must be one of type Buffer or Uint8Array'
    )
  }

  if (a === b) return 0

  var x = a.length
  var y = b.length

  for (var i = 0, len = Math.min(x, y); i < len; ++i) {
    if (a[i] !== b[i]) {
      x = a[i]
      y = b[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

Buffer.isEncoding = function isEncoding (encoding) {
  switch (String(encoding).toLowerCase()) {
    case 'hex':
    case 'utf8':
    case 'utf-8':
    case 'ascii':
    case 'latin1':
    case 'binary':
    case 'base64':
    case 'ucs2':
    case 'ucs-2':
    case 'utf16le':
    case 'utf-16le':
      return true
    default:
      return false
  }
}

Buffer.concat = function concat (list, length) {
  if (!Array.isArray(list)) {
    throw new TypeError('"list" argument must be an Array of Buffers')
  }

  if (list.length === 0) {
    return Buffer.alloc(0)
  }

  var i
  if (length === undefined) {
    length = 0
    for (i = 0; i < list.length; ++i) {
      length += list[i].length
    }
  }

  var buffer = Buffer.allocUnsafe(length)
  var pos = 0
  for (i = 0; i < list.length; ++i) {
    var buf = list[i]
    if (isInstance(buf, Uint8Array)) {
      buf = Buffer.from(buf)
    }
    if (!Buffer.isBuffer(buf)) {
      throw new TypeError('"list" argument must be an Array of Buffers')
    }
    buf.copy(buffer, pos)
    pos += buf.length
  }
  return buffer
}

function byteLength (string, encoding) {
  if (Buffer.isBuffer(string)) {
    return string.length
  }
  if (ArrayBuffer.isView(string) || isInstance(string, ArrayBuffer)) {
    return string.byteLength
  }
  if (typeof string !== 'string') {
    throw new TypeError(
      'The "string" argument must be one of type string, Buffer, or ArrayBuffer. ' +
      'Received type ' + typeof string
    )
  }

  var len = string.length
  var mustMatch = (arguments.length > 2 && arguments[2] === true)
  if (!mustMatch && len === 0) return 0

  // Use a for loop to avoid recursion
  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'ascii':
      case 'latin1':
      case 'binary':
        return len
      case 'utf8':
      case 'utf-8':
        return utf8ToBytes(string).length
      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return len * 2
      case 'hex':
        return len >>> 1
      case 'base64':
        return base64ToBytes(string).length
      default:
        if (loweredCase) {
          return mustMatch ? -1 : utf8ToBytes(string).length // assume utf8
        }
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}
Buffer.byteLength = byteLength

function slowToString (encoding, start, end) {
  var loweredCase = false

  // No need to verify that "this.length <= MAX_UINT32" since it's a read-only
  // property of a typed array.

  // This behaves neither like String nor Uint8Array in that we set start/end
  // to their upper/lower bounds if the value passed is out of range.
  // undefined is handled specially as per ECMA-262 6th Edition,
  // Section 13.3.3.7 Runtime Semantics: KeyedBindingInitialization.
  if (start === undefined || start < 0) {
    start = 0
  }
  // Return early if start > this.length. Done here to prevent potential uint32
  // coercion fail below.
  if (start > this.length) {
    return ''
  }

  if (end === undefined || end > this.length) {
    end = this.length
  }

  if (end <= 0) {
    return ''
  }

  // Force coersion to uint32. This will also coerce falsey/NaN values to 0.
  end >>>= 0
  start >>>= 0

  if (end <= start) {
    return ''
  }

  if (!encoding) encoding = 'utf8'

  while (true) {
    switch (encoding) {
      case 'hex':
        return hexSlice(this, start, end)

      case 'utf8':
      case 'utf-8':
        return utf8Slice(this, start, end)

      case 'ascii':
        return asciiSlice(this, start, end)

      case 'latin1':
      case 'binary':
        return latin1Slice(this, start, end)

      case 'base64':
        return base64Slice(this, start, end)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return utf16leSlice(this, start, end)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = (encoding + '').toLowerCase()
        loweredCase = true
    }
  }
}

// This property is used by `Buffer.isBuffer` (and the `is-buffer` npm package)
// to detect a Buffer instance. It's not possible to use `instanceof Buffer`
// reliably in a browserify context because there could be multiple different
// copies of the 'buffer' package in use. This method works even for Buffer
// instances that were created from another copy of the `buffer` package.
// See: https://github.com/feross/buffer/issues/154
Buffer.prototype._isBuffer = true

function swap (b, n, m) {
  var i = b[n]
  b[n] = b[m]
  b[m] = i
}

Buffer.prototype.swap16 = function swap16 () {
  var len = this.length
  if (len % 2 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 16-bits')
  }
  for (var i = 0; i < len; i += 2) {
    swap(this, i, i + 1)
  }
  return this
}

Buffer.prototype.swap32 = function swap32 () {
  var len = this.length
  if (len % 4 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 32-bits')
  }
  for (var i = 0; i < len; i += 4) {
    swap(this, i, i + 3)
    swap(this, i + 1, i + 2)
  }
  return this
}

Buffer.prototype.swap64 = function swap64 () {
  var len = this.length
  if (len % 8 !== 0) {
    throw new RangeError('Buffer size must be a multiple of 64-bits')
  }
  for (var i = 0; i < len; i += 8) {
    swap(this, i, i + 7)
    swap(this, i + 1, i + 6)
    swap(this, i + 2, i + 5)
    swap(this, i + 3, i + 4)
  }
  return this
}

Buffer.prototype.toString = function toString () {
  var length = this.length
  if (length === 0) return ''
  if (arguments.length === 0) return utf8Slice(this, 0, length)
  return slowToString.apply(this, arguments)
}

Buffer.prototype.toLocaleString = Buffer.prototype.toString

Buffer.prototype.equals = function equals (b) {
  if (!Buffer.isBuffer(b)) throw new TypeError('Argument must be a Buffer')
  if (this === b) return true
  return Buffer.compare(this, b) === 0
}

Buffer.prototype.inspect = function inspect () {
  var str = ''
  var max = exports.INSPECT_MAX_BYTES
  str = this.toString('hex', 0, max).replace(/(.{2})/g, '$1 ').trim()
  if (this.length > max) str += ' ... '
  return '<Buffer ' + str + '>'
}

Buffer.prototype.compare = function compare (target, start, end, thisStart, thisEnd) {
  if (isInstance(target, Uint8Array)) {
    target = Buffer.from(target, target.offset, target.byteLength)
  }
  if (!Buffer.isBuffer(target)) {
    throw new TypeError(
      'The "target" argument must be one of type Buffer or Uint8Array. ' +
      'Received type ' + (typeof target)
    )
  }

  if (start === undefined) {
    start = 0
  }
  if (end === undefined) {
    end = target ? target.length : 0
  }
  if (thisStart === undefined) {
    thisStart = 0
  }
  if (thisEnd === undefined) {
    thisEnd = this.length
  }

  if (start < 0 || end > target.length || thisStart < 0 || thisEnd > this.length) {
    throw new RangeError('out of range index')
  }

  if (thisStart >= thisEnd && start >= end) {
    return 0
  }
  if (thisStart >= thisEnd) {
    return -1
  }
  if (start >= end) {
    return 1
  }

  start >>>= 0
  end >>>= 0
  thisStart >>>= 0
  thisEnd >>>= 0

  if (this === target) return 0

  var x = thisEnd - thisStart
  var y = end - start
  var len = Math.min(x, y)

  var thisCopy = this.slice(thisStart, thisEnd)
  var targetCopy = target.slice(start, end)

  for (var i = 0; i < len; ++i) {
    if (thisCopy[i] !== targetCopy[i]) {
      x = thisCopy[i]
      y = targetCopy[i]
      break
    }
  }

  if (x < y) return -1
  if (y < x) return 1
  return 0
}

// Finds either the first index of `val` in `buffer` at offset >= `byteOffset`,
// OR the last index of `val` in `buffer` at offset <= `byteOffset`.
//
// Arguments:
// - buffer - a Buffer to search
// - val - a string, Buffer, or number
// - byteOffset - an index into `buffer`; will be clamped to an int32
// - encoding - an optional encoding, relevant is val is a string
// - dir - true for indexOf, false for lastIndexOf
function bidirectionalIndexOf (buffer, val, byteOffset, encoding, dir) {
  // Empty buffer means no match
  if (buffer.length === 0) return -1

  // Normalize byteOffset
  if (typeof byteOffset === 'string') {
    encoding = byteOffset
    byteOffset = 0
  } else if (byteOffset > 0x7fffffff) {
    byteOffset = 0x7fffffff
  } else if (byteOffset < -0x80000000) {
    byteOffset = -0x80000000
  }
  byteOffset = +byteOffset // Coerce to Number.
  if (numberIsNaN(byteOffset)) {
    // byteOffset: it it's undefined, null, NaN, "foo", etc, search whole buffer
    byteOffset = dir ? 0 : (buffer.length - 1)
  }

  // Normalize byteOffset: negative offsets start from the end of the buffer
  if (byteOffset < 0) byteOffset = buffer.length + byteOffset
  if (byteOffset >= buffer.length) {
    if (dir) return -1
    else byteOffset = buffer.length - 1
  } else if (byteOffset < 0) {
    if (dir) byteOffset = 0
    else return -1
  }

  // Normalize val
  if (typeof val === 'string') {
    val = Buffer.from(val, encoding)
  }

  // Finally, search either indexOf (if dir is true) or lastIndexOf
  if (Buffer.isBuffer(val)) {
    // Special case: looking for empty string/buffer always fails
    if (val.length === 0) {
      return -1
    }
    return arrayIndexOf(buffer, val, byteOffset, encoding, dir)
  } else if (typeof val === 'number') {
    val = val & 0xFF // Search for a byte value [0-255]
    if (typeof Uint8Array.prototype.indexOf === 'function') {
      if (dir) {
        return Uint8Array.prototype.indexOf.call(buffer, val, byteOffset)
      } else {
        return Uint8Array.prototype.lastIndexOf.call(buffer, val, byteOffset)
      }
    }
    return arrayIndexOf(buffer, [ val ], byteOffset, encoding, dir)
  }

  throw new TypeError('val must be string, number or Buffer')
}

function arrayIndexOf (arr, val, byteOffset, encoding, dir) {
  var indexSize = 1
  var arrLength = arr.length
  var valLength = val.length

  if (encoding !== undefined) {
    encoding = String(encoding).toLowerCase()
    if (encoding === 'ucs2' || encoding === 'ucs-2' ||
        encoding === 'utf16le' || encoding === 'utf-16le') {
      if (arr.length < 2 || val.length < 2) {
        return -1
      }
      indexSize = 2
      arrLength /= 2
      valLength /= 2
      byteOffset /= 2
    }
  }

  function read (buf, i) {
    if (indexSize === 1) {
      return buf[i]
    } else {
      return buf.readUInt16BE(i * indexSize)
    }
  }

  var i
  if (dir) {
    var foundIndex = -1
    for (i = byteOffset; i < arrLength; i++) {
      if (read(arr, i) === read(val, foundIndex === -1 ? 0 : i - foundIndex)) {
        if (foundIndex === -1) foundIndex = i
        if (i - foundIndex + 1 === valLength) return foundIndex * indexSize
      } else {
        if (foundIndex !== -1) i -= i - foundIndex
        foundIndex = -1
      }
    }
  } else {
    if (byteOffset + valLength > arrLength) byteOffset = arrLength - valLength
    for (i = byteOffset; i >= 0; i--) {
      var found = true
      for (var j = 0; j < valLength; j++) {
        if (read(arr, i + j) !== read(val, j)) {
          found = false
          break
        }
      }
      if (found) return i
    }
  }

  return -1
}

Buffer.prototype.includes = function includes (val, byteOffset, encoding) {
  return this.indexOf(val, byteOffset, encoding) !== -1
}

Buffer.prototype.indexOf = function indexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, true)
}

Buffer.prototype.lastIndexOf = function lastIndexOf (val, byteOffset, encoding) {
  return bidirectionalIndexOf(this, val, byteOffset, encoding, false)
}

function hexWrite (buf, string, offset, length) {
  offset = Number(offset) || 0
  var remaining = buf.length - offset
  if (!length) {
    length = remaining
  } else {
    length = Number(length)
    if (length > remaining) {
      length = remaining
    }
  }

  var strLen = string.length

  if (length > strLen / 2) {
    length = strLen / 2
  }
  for (var i = 0; i < length; ++i) {
    var parsed = parseInt(string.substr(i * 2, 2), 16)
    if (numberIsNaN(parsed)) return i
    buf[offset + i] = parsed
  }
  return i
}

function utf8Write (buf, string, offset, length) {
  return blitBuffer(utf8ToBytes(string, buf.length - offset), buf, offset, length)
}

function asciiWrite (buf, string, offset, length) {
  return blitBuffer(asciiToBytes(string), buf, offset, length)
}

function latin1Write (buf, string, offset, length) {
  return asciiWrite(buf, string, offset, length)
}

function base64Write (buf, string, offset, length) {
  return blitBuffer(base64ToBytes(string), buf, offset, length)
}

function ucs2Write (buf, string, offset, length) {
  return blitBuffer(utf16leToBytes(string, buf.length - offset), buf, offset, length)
}

Buffer.prototype.write = function write (string, offset, length, encoding) {
  // Buffer#write(string)
  if (offset === undefined) {
    encoding = 'utf8'
    length = this.length
    offset = 0
  // Buffer#write(string, encoding)
  } else if (length === undefined && typeof offset === 'string') {
    encoding = offset
    length = this.length
    offset = 0
  // Buffer#write(string, offset[, length][, encoding])
  } else if (isFinite(offset)) {
    offset = offset >>> 0
    if (isFinite(length)) {
      length = length >>> 0
      if (encoding === undefined) encoding = 'utf8'
    } else {
      encoding = length
      length = undefined
    }
  } else {
    throw new Error(
      'Buffer.write(string, encoding, offset[, length]) is no longer supported'
    )
  }

  var remaining = this.length - offset
  if (length === undefined || length > remaining) length = remaining

  if ((string.length > 0 && (length < 0 || offset < 0)) || offset > this.length) {
    throw new RangeError('Attempt to write outside buffer bounds')
  }

  if (!encoding) encoding = 'utf8'

  var loweredCase = false
  for (;;) {
    switch (encoding) {
      case 'hex':
        return hexWrite(this, string, offset, length)

      case 'utf8':
      case 'utf-8':
        return utf8Write(this, string, offset, length)

      case 'ascii':
        return asciiWrite(this, string, offset, length)

      case 'latin1':
      case 'binary':
        return latin1Write(this, string, offset, length)

      case 'base64':
        // Warning: maxLength not taken into account in base64Write
        return base64Write(this, string, offset, length)

      case 'ucs2':
      case 'ucs-2':
      case 'utf16le':
      case 'utf-16le':
        return ucs2Write(this, string, offset, length)

      default:
        if (loweredCase) throw new TypeError('Unknown encoding: ' + encoding)
        encoding = ('' + encoding).toLowerCase()
        loweredCase = true
    }
  }
}

Buffer.prototype.toJSON = function toJSON () {
  return {
    type: 'Buffer',
    data: Array.prototype.slice.call(this._arr || this, 0)
  }
}

function base64Slice (buf, start, end) {
  if (start === 0 && end === buf.length) {
    return base64.fromByteArray(buf)
  } else {
    return base64.fromByteArray(buf.slice(start, end))
  }
}

function utf8Slice (buf, start, end) {
  end = Math.min(buf.length, end)
  var res = []

  var i = start
  while (i < end) {
    var firstByte = buf[i]
    var codePoint = null
    var bytesPerSequence = (firstByte > 0xEF) ? 4
      : (firstByte > 0xDF) ? 3
        : (firstByte > 0xBF) ? 2
          : 1

    if (i + bytesPerSequence <= end) {
      var secondByte, thirdByte, fourthByte, tempCodePoint

      switch (bytesPerSequence) {
        case 1:
          if (firstByte < 0x80) {
            codePoint = firstByte
          }
          break
        case 2:
          secondByte = buf[i + 1]
          if ((secondByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0x1F) << 0x6 | (secondByte & 0x3F)
            if (tempCodePoint > 0x7F) {
              codePoint = tempCodePoint
            }
          }
          break
        case 3:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0xC | (secondByte & 0x3F) << 0x6 | (thirdByte & 0x3F)
            if (tempCodePoint > 0x7FF && (tempCodePoint < 0xD800 || tempCodePoint > 0xDFFF)) {
              codePoint = tempCodePoint
            }
          }
          break
        case 4:
          secondByte = buf[i + 1]
          thirdByte = buf[i + 2]
          fourthByte = buf[i + 3]
          if ((secondByte & 0xC0) === 0x80 && (thirdByte & 0xC0) === 0x80 && (fourthByte & 0xC0) === 0x80) {
            tempCodePoint = (firstByte & 0xF) << 0x12 | (secondByte & 0x3F) << 0xC | (thirdByte & 0x3F) << 0x6 | (fourthByte & 0x3F)
            if (tempCodePoint > 0xFFFF && tempCodePoint < 0x110000) {
              codePoint = tempCodePoint
            }
          }
      }
    }

    if (codePoint === null) {
      // we did not generate a valid codePoint so insert a
      // replacement char (U+FFFD) and advance only 1 byte
      codePoint = 0xFFFD
      bytesPerSequence = 1
    } else if (codePoint > 0xFFFF) {
      // encode to utf16 (surrogate pair dance)
      codePoint -= 0x10000
      res.push(codePoint >>> 10 & 0x3FF | 0xD800)
      codePoint = 0xDC00 | codePoint & 0x3FF
    }

    res.push(codePoint)
    i += bytesPerSequence
  }

  return decodeCodePointsArray(res)
}

// Based on http://stackoverflow.com/a/22747272/680742, the browser with
// the lowest limit is Chrome, with 0x10000 args.
// We go 1 magnitude less, for safety
var MAX_ARGUMENTS_LENGTH = 0x1000

function decodeCodePointsArray (codePoints) {
  var len = codePoints.length
  if (len <= MAX_ARGUMENTS_LENGTH) {
    return String.fromCharCode.apply(String, codePoints) // avoid extra slice()
  }

  // Decode in chunks to avoid "call stack size exceeded".
  var res = ''
  var i = 0
  while (i < len) {
    res += String.fromCharCode.apply(
      String,
      codePoints.slice(i, i += MAX_ARGUMENTS_LENGTH)
    )
  }
  return res
}

function asciiSlice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i] & 0x7F)
  }
  return ret
}

function latin1Slice (buf, start, end) {
  var ret = ''
  end = Math.min(buf.length, end)

  for (var i = start; i < end; ++i) {
    ret += String.fromCharCode(buf[i])
  }
  return ret
}

function hexSlice (buf, start, end) {
  var len = buf.length

  if (!start || start < 0) start = 0
  if (!end || end < 0 || end > len) end = len

  var out = ''
  for (var i = start; i < end; ++i) {
    out += toHex(buf[i])
  }
  return out
}

function utf16leSlice (buf, start, end) {
  var bytes = buf.slice(start, end)
  var res = ''
  for (var i = 0; i < bytes.length; i += 2) {
    res += String.fromCharCode(bytes[i] + (bytes[i + 1] * 256))
  }
  return res
}

Buffer.prototype.slice = function slice (start, end) {
  var len = this.length
  start = ~~start
  end = end === undefined ? len : ~~end

  if (start < 0) {
    start += len
    if (start < 0) start = 0
  } else if (start > len) {
    start = len
  }

  if (end < 0) {
    end += len
    if (end < 0) end = 0
  } else if (end > len) {
    end = len
  }

  if (end < start) end = start

  var newBuf = this.subarray(start, end)
  // Return an augmented `Uint8Array` instance
  newBuf.__proto__ = Buffer.prototype
  return newBuf
}

/*
 * Need to make sure that buffer isn't trying to write out of bounds.
 */
function checkOffset (offset, ext, length) {
  if ((offset % 1) !== 0 || offset < 0) throw new RangeError('offset is not uint')
  if (offset + ext > length) throw new RangeError('Trying to access beyond buffer length')
}

Buffer.prototype.readUIntLE = function readUIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }

  return val
}

Buffer.prototype.readUIntBE = function readUIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    checkOffset(offset, byteLength, this.length)
  }

  var val = this[offset + --byteLength]
  var mul = 1
  while (byteLength > 0 && (mul *= 0x100)) {
    val += this[offset + --byteLength] * mul
  }

  return val
}

Buffer.prototype.readUInt8 = function readUInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  return this[offset]
}

Buffer.prototype.readUInt16LE = function readUInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return this[offset] | (this[offset + 1] << 8)
}

Buffer.prototype.readUInt16BE = function readUInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  return (this[offset] << 8) | this[offset + 1]
}

Buffer.prototype.readUInt32LE = function readUInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return ((this[offset]) |
      (this[offset + 1] << 8) |
      (this[offset + 2] << 16)) +
      (this[offset + 3] * 0x1000000)
}

Buffer.prototype.readUInt32BE = function readUInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] * 0x1000000) +
    ((this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    this[offset + 3])
}

Buffer.prototype.readIntLE = function readIntLE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var val = this[offset]
  var mul = 1
  var i = 0
  while (++i < byteLength && (mul *= 0x100)) {
    val += this[offset + i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readIntBE = function readIntBE (offset, byteLength, noAssert) {
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) checkOffset(offset, byteLength, this.length)

  var i = byteLength
  var mul = 1
  var val = this[offset + --i]
  while (i > 0 && (mul *= 0x100)) {
    val += this[offset + --i] * mul
  }
  mul *= 0x80

  if (val >= mul) val -= Math.pow(2, 8 * byteLength)

  return val
}

Buffer.prototype.readInt8 = function readInt8 (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 1, this.length)
  if (!(this[offset] & 0x80)) return (this[offset])
  return ((0xff - this[offset] + 1) * -1)
}

Buffer.prototype.readInt16LE = function readInt16LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset] | (this[offset + 1] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt16BE = function readInt16BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 2, this.length)
  var val = this[offset + 1] | (this[offset] << 8)
  return (val & 0x8000) ? val | 0xFFFF0000 : val
}

Buffer.prototype.readInt32LE = function readInt32LE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset]) |
    (this[offset + 1] << 8) |
    (this[offset + 2] << 16) |
    (this[offset + 3] << 24)
}

Buffer.prototype.readInt32BE = function readInt32BE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)

  return (this[offset] << 24) |
    (this[offset + 1] << 16) |
    (this[offset + 2] << 8) |
    (this[offset + 3])
}

Buffer.prototype.readFloatLE = function readFloatLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, true, 23, 4)
}

Buffer.prototype.readFloatBE = function readFloatBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 4, this.length)
  return ieee754.read(this, offset, false, 23, 4)
}

Buffer.prototype.readDoubleLE = function readDoubleLE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, true, 52, 8)
}

Buffer.prototype.readDoubleBE = function readDoubleBE (offset, noAssert) {
  offset = offset >>> 0
  if (!noAssert) checkOffset(offset, 8, this.length)
  return ieee754.read(this, offset, false, 52, 8)
}

function checkInt (buf, value, offset, ext, max, min) {
  if (!Buffer.isBuffer(buf)) throw new TypeError('"buffer" argument must be a Buffer instance')
  if (value > max || value < min) throw new RangeError('"value" argument is out of bounds')
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
}

Buffer.prototype.writeUIntLE = function writeUIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var mul = 1
  var i = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUIntBE = function writeUIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  byteLength = byteLength >>> 0
  if (!noAssert) {
    var maxBytes = Math.pow(2, 8 * byteLength) - 1
    checkInt(this, value, offset, byteLength, maxBytes, 0)
  }

  var i = byteLength - 1
  var mul = 1
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    this[offset + i] = (value / mul) & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeUInt8 = function writeUInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0xff, 0)
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeUInt16LE = function writeUInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeUInt16BE = function writeUInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0xffff, 0)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeUInt32LE = function writeUInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset + 3] = (value >>> 24)
  this[offset + 2] = (value >>> 16)
  this[offset + 1] = (value >>> 8)
  this[offset] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeUInt32BE = function writeUInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0xffffffff, 0)
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

Buffer.prototype.writeIntLE = function writeIntLE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = 0
  var mul = 1
  var sub = 0
  this[offset] = value & 0xFF
  while (++i < byteLength && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i - 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeIntBE = function writeIntBE (value, offset, byteLength, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    var limit = Math.pow(2, (8 * byteLength) - 1)

    checkInt(this, value, offset, byteLength, limit - 1, -limit)
  }

  var i = byteLength - 1
  var mul = 1
  var sub = 0
  this[offset + i] = value & 0xFF
  while (--i >= 0 && (mul *= 0x100)) {
    if (value < 0 && sub === 0 && this[offset + i + 1] !== 0) {
      sub = 1
    }
    this[offset + i] = ((value / mul) >> 0) - sub & 0xFF
  }

  return offset + byteLength
}

Buffer.prototype.writeInt8 = function writeInt8 (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 1, 0x7f, -0x80)
  if (value < 0) value = 0xff + value + 1
  this[offset] = (value & 0xff)
  return offset + 1
}

Buffer.prototype.writeInt16LE = function writeInt16LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  return offset + 2
}

Buffer.prototype.writeInt16BE = function writeInt16BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 2, 0x7fff, -0x8000)
  this[offset] = (value >>> 8)
  this[offset + 1] = (value & 0xff)
  return offset + 2
}

Buffer.prototype.writeInt32LE = function writeInt32LE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  this[offset] = (value & 0xff)
  this[offset + 1] = (value >>> 8)
  this[offset + 2] = (value >>> 16)
  this[offset + 3] = (value >>> 24)
  return offset + 4
}

Buffer.prototype.writeInt32BE = function writeInt32BE (value, offset, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) checkInt(this, value, offset, 4, 0x7fffffff, -0x80000000)
  if (value < 0) value = 0xffffffff + value + 1
  this[offset] = (value >>> 24)
  this[offset + 1] = (value >>> 16)
  this[offset + 2] = (value >>> 8)
  this[offset + 3] = (value & 0xff)
  return offset + 4
}

function checkIEEE754 (buf, value, offset, ext, max, min) {
  if (offset + ext > buf.length) throw new RangeError('Index out of range')
  if (offset < 0) throw new RangeError('Index out of range')
}

function writeFloat (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 4, 3.4028234663852886e+38, -3.4028234663852886e+38)
  }
  ieee754.write(buf, value, offset, littleEndian, 23, 4)
  return offset + 4
}

Buffer.prototype.writeFloatLE = function writeFloatLE (value, offset, noAssert) {
  return writeFloat(this, value, offset, true, noAssert)
}

Buffer.prototype.writeFloatBE = function writeFloatBE (value, offset, noAssert) {
  return writeFloat(this, value, offset, false, noAssert)
}

function writeDouble (buf, value, offset, littleEndian, noAssert) {
  value = +value
  offset = offset >>> 0
  if (!noAssert) {
    checkIEEE754(buf, value, offset, 8, 1.7976931348623157E+308, -1.7976931348623157E+308)
  }
  ieee754.write(buf, value, offset, littleEndian, 52, 8)
  return offset + 8
}

Buffer.prototype.writeDoubleLE = function writeDoubleLE (value, offset, noAssert) {
  return writeDouble(this, value, offset, true, noAssert)
}

Buffer.prototype.writeDoubleBE = function writeDoubleBE (value, offset, noAssert) {
  return writeDouble(this, value, offset, false, noAssert)
}

// copy(targetBuffer, targetStart=0, sourceStart=0, sourceEnd=buffer.length)
Buffer.prototype.copy = function copy (target, targetStart, start, end) {
  if (!Buffer.isBuffer(target)) throw new TypeError('argument should be a Buffer')
  if (!start) start = 0
  if (!end && end !== 0) end = this.length
  if (targetStart >= target.length) targetStart = target.length
  if (!targetStart) targetStart = 0
  if (end > 0 && end < start) end = start

  // Copy 0 bytes; we're done
  if (end === start) return 0
  if (target.length === 0 || this.length === 0) return 0

  // Fatal error conditions
  if (targetStart < 0) {
    throw new RangeError('targetStart out of bounds')
  }
  if (start < 0 || start >= this.length) throw new RangeError('Index out of range')
  if (end < 0) throw new RangeError('sourceEnd out of bounds')

  // Are we oob?
  if (end > this.length) end = this.length
  if (target.length - targetStart < end - start) {
    end = target.length - targetStart + start
  }

  var len = end - start

  if (this === target && typeof Uint8Array.prototype.copyWithin === 'function') {
    // Use built-in when available, missing from IE11
    this.copyWithin(targetStart, start, end)
  } else if (this === target && start < targetStart && targetStart < end) {
    // descending copy from end
    for (var i = len - 1; i >= 0; --i) {
      target[i + targetStart] = this[i + start]
    }
  } else {
    Uint8Array.prototype.set.call(
      target,
      this.subarray(start, end),
      targetStart
    )
  }

  return len
}

// Usage:
//    buffer.fill(number[, offset[, end]])
//    buffer.fill(buffer[, offset[, end]])
//    buffer.fill(string[, offset[, end]][, encoding])
Buffer.prototype.fill = function fill (val, start, end, encoding) {
  // Handle string cases:
  if (typeof val === 'string') {
    if (typeof start === 'string') {
      encoding = start
      start = 0
      end = this.length
    } else if (typeof end === 'string') {
      encoding = end
      end = this.length
    }
    if (encoding !== undefined && typeof encoding !== 'string') {
      throw new TypeError('encoding must be a string')
    }
    if (typeof encoding === 'string' && !Buffer.isEncoding(encoding)) {
      throw new TypeError('Unknown encoding: ' + encoding)
    }
    if (val.length === 1) {
      var code = val.charCodeAt(0)
      if ((encoding === 'utf8' && code < 128) ||
          encoding === 'latin1') {
        // Fast path: If `val` fits into a single byte, use that numeric value.
        val = code
      }
    }
  } else if (typeof val === 'number') {
    val = val & 255
  }

  // Invalid ranges are not set to a default, so can range check early.
  if (start < 0 || this.length < start || this.length < end) {
    throw new RangeError('Out of range index')
  }

  if (end <= start) {
    return this
  }

  start = start >>> 0
  end = end === undefined ? this.length : end >>> 0

  if (!val) val = 0

  var i
  if (typeof val === 'number') {
    for (i = start; i < end; ++i) {
      this[i] = val
    }
  } else {
    var bytes = Buffer.isBuffer(val)
      ? val
      : Buffer.from(val, encoding)
    var len = bytes.length
    if (len === 0) {
      throw new TypeError('The value "' + val +
        '" is invalid for argument "value"')
    }
    for (i = 0; i < end - start; ++i) {
      this[i + start] = bytes[i % len]
    }
  }

  return this
}

// HELPER FUNCTIONS
// ================

var INVALID_BASE64_RE = /[^+/0-9A-Za-z-_]/g

function base64clean (str) {
  // Node takes equal signs as end of the Base64 encoding
  str = str.split('=')[0]
  // Node strips out invalid characters like \n and \t from the string, base64-js does not
  str = str.trim().replace(INVALID_BASE64_RE, '')
  // Node converts strings with length < 2 to ''
  if (str.length < 2) return ''
  // Node allows for non-padded base64 strings (missing trailing ===), base64-js does not
  while (str.length % 4 !== 0) {
    str = str + '='
  }
  return str
}

function toHex (n) {
  if (n < 16) return '0' + n.toString(16)
  return n.toString(16)
}

function utf8ToBytes (string, units) {
  units = units || Infinity
  var codePoint
  var length = string.length
  var leadSurrogate = null
  var bytes = []

  for (var i = 0; i < length; ++i) {
    codePoint = string.charCodeAt(i)

    // is surrogate component
    if (codePoint > 0xD7FF && codePoint < 0xE000) {
      // last char was a lead
      if (!leadSurrogate) {
        // no lead yet
        if (codePoint > 0xDBFF) {
          // unexpected trail
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        } else if (i + 1 === length) {
          // unpaired lead
          if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
          continue
        }

        // valid lead
        leadSurrogate = codePoint

        continue
      }

      // 2 leads in a row
      if (codePoint < 0xDC00) {
        if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
        leadSurrogate = codePoint
        continue
      }

      // valid surrogate pair
      codePoint = (leadSurrogate - 0xD800 << 10 | codePoint - 0xDC00) + 0x10000
    } else if (leadSurrogate) {
      // valid bmp char, but last char was a lead
      if ((units -= 3) > -1) bytes.push(0xEF, 0xBF, 0xBD)
    }

    leadSurrogate = null

    // encode utf8
    if (codePoint < 0x80) {
      if ((units -= 1) < 0) break
      bytes.push(codePoint)
    } else if (codePoint < 0x800) {
      if ((units -= 2) < 0) break
      bytes.push(
        codePoint >> 0x6 | 0xC0,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x10000) {
      if ((units -= 3) < 0) break
      bytes.push(
        codePoint >> 0xC | 0xE0,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else if (codePoint < 0x110000) {
      if ((units -= 4) < 0) break
      bytes.push(
        codePoint >> 0x12 | 0xF0,
        codePoint >> 0xC & 0x3F | 0x80,
        codePoint >> 0x6 & 0x3F | 0x80,
        codePoint & 0x3F | 0x80
      )
    } else {
      throw new Error('Invalid code point')
    }
  }

  return bytes
}

function asciiToBytes (str) {
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    // Node's code seems to be doing this and not & 0x7F..
    byteArray.push(str.charCodeAt(i) & 0xFF)
  }
  return byteArray
}

function utf16leToBytes (str, units) {
  var c, hi, lo
  var byteArray = []
  for (var i = 0; i < str.length; ++i) {
    if ((units -= 2) < 0) break

    c = str.charCodeAt(i)
    hi = c >> 8
    lo = c % 256
    byteArray.push(lo)
    byteArray.push(hi)
  }

  return byteArray
}

function base64ToBytes (str) {
  return base64.toByteArray(base64clean(str))
}

function blitBuffer (src, dst, offset, length) {
  for (var i = 0; i < length; ++i) {
    if ((i + offset >= dst.length) || (i >= src.length)) break
    dst[i + offset] = src[i]
  }
  return i
}

// ArrayBuffer or Uint8Array objects from other contexts (i.e. iframes) do not pass
// the `instanceof` check but they should be treated as of that type.
// See: https://github.com/feross/buffer/issues/166
function isInstance (obj, type) {
  return obj instanceof type ||
    (obj != null && obj.constructor != null && obj.constructor.name != null &&
      obj.constructor.name === type.name)
}
function numberIsNaN (obj) {
  // For IE11 support
  return obj !== obj // eslint-disable-line no-self-compare
}

}).call(this)}).call(this,require("buffer").Buffer)
},{"base64-js":1,"buffer":2,"ieee754":9}],3:[function(require,module,exports){
'use strict';

Object.defineProperty(exports, '__esModule', { value: true });

function _interopDefault (ex) { return (ex && (typeof ex === 'object') && 'default' in ex) ? ex['default'] : ex; }

var split = _interopDefault(require('graphemesplit'));

const splitUnicode = str => str.normalize("NFKD").split("");

const whitespaceRegex = /^\s+$/;
const nonWordRegex = /^[`~!@#$%^&*()\-=_+{}[\]\|\\;':",./<>?]+$/;
const sortKind = {
  insertOrder: "insertOrder",
  bestMatch: "bestMatch"
}; // the default options, which will be used for any unset option

const defaultOptions = {
  keySelector: s => s,
  threshold: .6,
  ignoreCase: true,
  ignoreSymbols: true,
  normalizeWhitespace: true,
  returnMatchData: false,
  useDamerau: true,
  useSellers: true,
  useSeparatedUnicode: false,
  sortBy: sortKind.bestMatch
};

const noop = () => {};

const arrayWrap = item => item instanceof Array ? item : [item]; // return normalized string, with map included


function normalize(string, options) {
  const lower = options.ignoreCase ? string.toLocaleLowerCase() : string; // track transformations

  const normal = [];
  const map = [];
  let lastWasWhitespace = true;
  let length = 0;
  const graphemeList = options.useSeparatedUnicode ? splitUnicode(lower) : split(lower);

  for (const grapheme of graphemeList) {
    whitespaceRegex.lastIndex = 0;
    nonWordRegex.lastIndex = 0;

    if (options.normalizeWhitespace && whitespaceRegex.test(grapheme)) {
      if (!lastWasWhitespace) {
        normal.push(" ");
        map.push(length);
        lastWasWhitespace = true;
      }
    } else if (!(options.ignoreSymbols && nonWordRegex.test(grapheme))) {
      if (options.useSeparatedUnicode) {
        normal.push(grapheme);
      } else {
        normal.push(grapheme.normalize());
      }

      map.push(length);
      lastWasWhitespace = false;
    }

    length += grapheme.length;
  } // add the end of the string


  map.push(string.length);

  while (normal[normal.length - 1] === " ") {
    normal.pop();
    map.pop();
  }

  return {
    original: string,
    normal,
    map
  };
} // translates a match to the original string


function denormalizeMatchPosition(match, map) {
  return {
    index: map[match.start],
    length: map[match.end + 1] - map[match.start]
  };
} // walks back up the matrix to find the match index and length


function walkBack(rows, scoreIndex) {
  if (scoreIndex === 0) {
    return {
      index: 0,
      length: 0
    };
  }

  let start = scoreIndex;

  for (let i = rows.length - 2; i > 0 && start > 1; i--) {
    const row = rows[i];
    start = row[start] < row[start - 1] ? start : start - 1;
  }

  return {
    start: start - 1,
    end: scoreIndex - 1
  };
} // walkback is a noop for non-sellers, but should still return an object


function noopWalkback() {
  return {
    start: 0,
    end: 0
  };
}

const levUpdateScore = () => true;

const sellersUpdateScore = (cur, min) => cur < min;

function getLevScore(rows, length) {
  const lastRow = rows[rows.length - 1];
  const lastCell = lastRow[length - 1];
  const scoreLength = Math.max(rows.length, length);
  return {
    score: 1 - lastCell / (scoreLength - 1),
    scoreIndex: length - 1
  };
}

function getSellersScore(rows, length) {
  // search term was empty string, return perfect score
  if (rows.length === 1) {
    return {
      score: 1,
      scoreIndex: 0
    };
  }

  const lastRow = rows[rows.length - 1];
  let minValue = lastRow[0];
  let minIndex = 0;

  for (let i = 1; i < length; i++) {
    const val = lastRow[i];

    if (val < minValue) {
      minValue = val;
      minIndex = i;
    }
  }

  return {
    score: 1 - minValue / (rows.length - 1),
    scoreIndex: minIndex
  };
}

function initLevRows(rowCount, columnCount) {
  const rows = new Array(rowCount);

  for (let i = 0; i < rowCount; i++) {
    rows[i] = new Array(columnCount);
    rows[i][0] = i;
  }

  for (let i = 0; i < columnCount; i++) {
    rows[0][i] = i;
  }

  return rows;
}

function initSellersRows(rowCount, columnCount) {
  const rows = new Array(rowCount);
  rows[0] = new Array(columnCount).fill(0);

  for (let i = 1; i < rowCount; i++) {
    rows[i] = new Array(columnCount);
    rows[i][0] = i;
  }

  return rows;
} // the content of the innermost loop of levenshtein


function levCore(term, candidate, rows, i, j) {
  const rowA = rows[i];
  const rowB = rows[i + 1];
  const cost = term[i] === candidate[j] ? 0 : 1;
  let m;
  let min = rowB[j] + 1; // insertion

  if ((m = rowA[j + 1] + 1) < min) min = m; // deletion

  if ((m = rowA[j] + cost) < min) min = m; // substitution

  rowB[j + 1] = min;
} // runtime complexity: O(mn) where m and n are the lengths of term and candidate, respectively
// Note: this method only runs on a single column


function levenshtein(term, candidate, rows, j) {
  for (let i = 0; i < term.length; i++) {
    levCore(term, candidate, rows, i, j);
  }
} // has all the runtime characteristics of the above, but punishes transpositions less,
// resulting in better tolerance to those types of typos
// Note: this method only runs on a single column


function damerauLevenshtein(term, candidate, rows, j) {
  // if j === 0, we can't check for transpositions,
  // so use normal levenshtein instead
  if (j === 0) {
    levenshtein(term, candidate, rows, j);
    return;
  } // for i === 0, we also can't check for transpositions, so calculate
  // the first row using normal levenshtein as well


  if (term.length > 0) {
    levCore(term, candidate, rows, 0, j);
  }

  for (let i = 1; i < term.length; i++) {
    const rowA = rows[i - 1];
    const rowB = rows[i];
    const rowC = rows[i + 1];
    const cost = term[i] === candidate[j] ? 0 : 1;
    let m; // insertion

    let min = rowC[j] + 1; // deletion

    if ((m = rowB[j + 1] + 1) < min) min = m; // substitution

    if ((m = rowB[j] + cost) < min) min = m; // transposition

    if (term[i] === candidate[j - 1] && term[i - 1] === candidate[j] && (m = rowA[j - 1] + cost) < min) min = m;
    rowC[j + 1] = min;
  }
} // method for creating a trie from search candidates
// using a trie can significantly improve search time


function trieInsert(trie, string, item) {
  let walker = trie;

  for (let i = 0; i < string.length; i++) {
    const char = string[i]; // add child node if not already present

    if (walker.children[char] == null) {
      walker.children[char] = {
        children: {},
        candidates: [],
        depth: 0
      };
    } // log max depth of this subtree


    walker.depth = Math.max(walker.depth, string.length - i); // step into child node

    walker = walker.children[char];
  }

  walker.candidates.push(item);
} // transforms a list of candidates into objects with normalized search keys,
// and inserts them into a trie
// the keySelector is used to pick strings from an object to search by


function createSearchTrie(trie, index, items, options) {
  for (const item of items) {
    const candidates = arrayWrap(options.keySelector(item)).map((key, keyIndex) => ({
      index,
      keyIndex,
      item,
      normalized: normalize(key, options)
    }));
    index++;

    for (const candidate of candidates) {
      trieInsert(trie, candidate.normalized.normal, candidate);
    }
  }
} // scored item comparator


function compareItemsBestScore(a, b) {
  // highest priority is raw levenshtein score
  const scoreDiff = b.score - a.score;

  if (scoreDiff !== 0) {
    return scoreDiff;
  } // ties are broken by earlier match positions


  const matchPosDiff = a.match.start - b.match.start;

  if (matchPosDiff !== 0) {
    return matchPosDiff;
  } // prioritize earlier keys


  const keyIndexDiff = a.keyIndex - b.keyIndex;

  if (keyIndexDiff !== 0) {
    return keyIndexDiff;
  } // lastly, break ties by preferring the closer length match


  const lengthDiff = a.lengthDiff - b.lengthDiff;

  if (lengthDiff !== 0) {
    return lengthDiff;
  } // if all else fails, resort to insertion order


  return compareItemsInsertOrder(a, b);
}

function compareItemsInsertOrder(a, b) {
  return a.index - b.index;
}

function getCompareFunc(sortBy) {
  switch (sortBy) {
    case sortKind.bestMatch:
      return compareItemsBestScore;

    case sortKind.insertOrder:
      return compareItemsInsertOrder;

    default:
      throw new Error(`unknown sortBy method ${sortBy}`);
  }
} // dedupes and adds results to the results list/map


function addResult(results, resultMap, candidate, score, match, lengthDiff, compareItems) {
  const scoredItem = {
    item: candidate.item,
    normalized: candidate.normalized,
    score,
    match,
    index: candidate.index,
    keyIndex: candidate.keyIndex,
    lengthDiff
  };

  if (resultMap[candidate.index] == null) {
    resultMap[candidate.index] = results.length;
    results.push(scoredItem);
  } else if (compareItems(scoredItem, results[resultMap[candidate.index]]) < 0) {
    results[resultMap[candidate.index]] = scoredItem;
  }
}

const getLevLength = Math.max;

const getSellersLength = termLength => termLength; // skip any subtrees for which it is impossible to score >= threshold


function levShouldContinue(node, pos, term, threshold, sValue) {
  // earliest point (length) at which sValue could return to 0
  const p1 = pos + sValue; // point (length) at which string lengths would match

  const p2 = Math.min(term.length, pos + node.depth + 1); // the best score possible is the string which minimizes the value
  // max(sValue, strLenDiff), which is always halfway between p1 and p2

  const length = Math.ceil((p1 + p2) / 2);
  const bestPossibleValue = length - p2;
  return 1 - bestPossibleValue / length >= threshold;
}

function sellersShouldContinue(node, _, term, threshold, sValue, lastValue) {
  const bestPossibleValue = Math.min(sValue, lastValue - (node.depth + 1));
  return 1 - bestPossibleValue / term.length >= threshold;
} // (pseudo) recursively walk the trie


function searchRecurse(trie, term, scoreMethods, rows, results, resultMap, options) {
  const stack = [];

  for (const key in trie.children) {
    const node = trie.children[key];
    stack.push([node, 1, key, 0, term.length]);
  }

  const acc = new Array(trie.depth);

  while (stack.length !== 0) {
    const [node, len, char, si, sv] = stack.pop();
    acc[len - 1] = char; // build rows

    scoreMethods.score(term, acc, rows, len - 1); // track best score and position

    const lastIndex = len;
    const lastValue = rows[rows.length - 1][lastIndex];
    let sIndex = si,
        sValue = sv;

    if (scoreMethods.shouldUpdateScore(lastValue, sv)) {
      sIndex = lastIndex;
      sValue = lastValue;
    } // insert results


    if (node.candidates.length > 0) {
      const length = scoreMethods.getLength(term.length, len);
      const score = 1 - sValue / length;

      if (score >= options.threshold) {
        const match = walkBack(rows, sIndex);
        const lengthDiff = Math.abs(len - term.length);

        for (const candidate of node.candidates) {
          addResult(results, resultMap, candidate, score, match, lengthDiff, scoreMethods.compareItems);
        }
      }
    } // recurse for children


    for (const key in node.children) {
      const child = node.children[key];

      if (scoreMethods.shouldContinue(child, len, term, options.threshold, sValue, lastValue)) {
        stack.push([child, len + 1, key, sIndex, sValue]);
      }
    }
  }
} // the core match finder: returns a sorted, filtered list of matches
// this does not normalize input, requiring users to normalize themselves


function searchCore(term, trie, options) {
  const initMethod = options.useSellers ? initSellersRows : initLevRows;
  const scoreMethods = {
    score: options.useDamerau ? damerauLevenshtein : levenshtein,
    getLength: options.useSellers ? getSellersLength : getLevLength,
    shouldUpdateScore: options.useSellers ? sellersUpdateScore : levUpdateScore,
    shouldContinue: options.useSellers ? sellersShouldContinue : levShouldContinue,
    walkBack: options.useSellers ? walkBack : noopWalkback,
    compareItems: getCompareFunc(options.sortBy)
  }; // walk the trie, scoring and storing the candidates

  const resultMap = {};
  const results = [];
  const rows = initMethod(term.length + 1, trie.depth + 1);

  if (options.threshold <= 0 || term.length === 0) {
    for (const candidate of trie.candidates) {
      addResult(results, resultMap, candidate, 0, {
        index: 0,
        length: 0
      }, term.length, scoreMethods.compareItems);
    }
  }

  searchRecurse(trie, term, scoreMethods, rows, results, resultMap, options);
  const sorted = results.sort(scoreMethods.compareItems);

  if (options.returnMatchData) {
    const denormalize = options.useSellers ? denormalizeMatchPosition : noop;
    return sorted.map(candidate => ({
      item: candidate.item,
      original: candidate.normalized.original,
      key: candidate.normalized.normal.join(""),
      score: candidate.score,
      match: denormalize(candidate.match, candidate.normalized.map)
    }));
  }

  return sorted.map(candidate => candidate.item);
} // wrapper for exporting sellers while allowing options to be passed in


function fuzzy(term, candidate, options) {
  options = { ...defaultOptions,
    ...options
  };
  const initMethod = options.useSellers ? initSellersRows : initLevRows;
  const scoreMethod = options.useDamerau ? damerauLevenshtein : levenshtein;
  const getScore = options.useSellers ? getSellersScore : getLevScore;
  term = normalize(term, options).normal;
  const normalized = normalize(candidate, options);
  const rows = initMethod(term.length + 1, normalized.normal.length + 1);

  for (let j = 0; j < normalized.normal.length; j++) {
    scoreMethod(term, normalized.normal, rows, j);
  }

  const scoreResult = getScore(rows, normalized.normal.length + 1);
  return options.returnMatchData ? {
    item: candidate,
    original: normalized.original,
    key: normalized.normal.join(""),
    score: scoreResult.score,
    match: options.useSellers ? denormalizeMatchPosition(walkBack(rows, scoreResult.scoreIndex), normalized.map) : noop()
  } : scoreResult.score;
} // simple one-off search. Useful if you don't expect to use the same candidate list again

function search(term, candidates, options) {
  options = { ...defaultOptions,
    ...options
  };
  const trie = {
    children: {},
    candidates: [],
    depth: 0
  };
  createSearchTrie(trie, 0, candidates, options);
  return searchCore(normalize(term, options).normal, trie, options);
} // class that improves performance of searching the same set multiple times
// normalizes the strings and caches the result for future calls

class Searcher {
  constructor(candidates, options) {
    this.options = Object.assign({}, defaultOptions, options);
    this.trie = {
      children: {},
      candidates: [],
      depth: 0
    };
    createSearchTrie(this.trie, 0, candidates, this.options);
    this.count = candidates.length;
  }

  add(...candidates) {
    createSearchTrie(this.trie, this.count, candidates, this.options);
    this.count += candidates.length;
  }

  search(term, options) {
    options = Object.assign({}, this.options, options);
    return searchCore(normalize(term, this.options).normal, this.trie, options);
  }

}

exports.Searcher = Searcher;
exports.fuzzy = fuzzy;
exports.search = search;
exports.sortKind = sortKind;

},{"graphemesplit":6}],4:[function(require,module,exports){
module.exports={"data":"AAACAAAAAACAOAAAAbYBSf7t2S1IBEEYBuDVDZ7FYrQMNsFiu3hgEYOI0SCXRIUrB8JhEZtgs5gEg1GMFk02m82oGI02m+9xezCOczv/uwv3fvAwc/PzfXOzcdqzWdaBDdiGPdiHdjE+DS3RNDuCfsn8idQ/g3OH3BdwKf0e96/gumTfYcncLdzBPTzAo+RZ+f0Cr/AG7/AJX4738x1wtz9FO5PX/50n6UXMNdfg/0lERERERERERERERETpdedHBvDRql4nq0cXtW9af98qdRby0Vvp8K4W0V+C5Xw0t4J2bfjeBp3cnEu1brnnCTYNa7eKdz91XP7WO9Lb4GqRb7cY6xbtAdqeVOsY/QGcevw/tb6OT85YhvfKYEx9CMuxKsKnrs+eJtVInVvHJ0eVYVvTZk2siFVLOCjb61PTZX3MdVWEyP7fjzpmMxdzTyq2Ebue6x61nXRGnzndWpf1an7dXmGYE4Y1ptqqKsK1nu26Ju0ty+maV2Rpvk+qnDZjKUIobUiesdAQE/jmCTmHmsskpFZsVYbtmXRcaoSGUPomunW2derQhDPFjtT1Q/eb8vnm990fq35oHVt11bU9m89c7DNI8Qs="}
},{}],5:[function(require,module,exports){
module.exports={"data":"AAgOAAAAAABQfgAAAWMGnPntmm2IVUUYx+dyb2ezXXtBiSCLsKDIiKIIoYINciGwQHrRL2Ufii0qMsv7QVBuQkXhkmW5gksQRhRFSBslbkllHyy3L2XllkXrB3uhF0tQ0Kj+xzN3d3buzJx5PeesOw/8mDNvz/PMnOc8s/fs6asTcgu4A9wF+mjdV9kEa8FqsE5j/DPgeUX/JvASeBW8Bd4GO8CHYDcz7nPwFRgD4+An8Cf4AxwBx0G9QcjrYBt4p5HN/YDqGEF9F7gW3AC6wU1gCVgK5oDlYA8YBXvBGOgHD4FzwSo6fg24EDwBxsEB8Cu1N4ByI1gA/gbfo+0wyuO0vgW8DK5i+tN5tVOyMmUWrs9k6nNxPY/WL0B5Mb2+HOU14HrwY2Ny/CLUbwa3gzsZPT7ZGECnDvdiPQ+ARyhpWxPlWnr9JLfeAdS/43S8qNiTIdq3FeUb9HolOEj7h9H2LtgJPgHr0TZKx31Jy30C/T+g7aDCbpPiuj/fStrTNfQGioWIHr9z+z8iiAEfdg4zdo7Gex6JRCKRSCQSiUQikYrzL367HmLq8zV+yyYJIbOTzva5aJtH2y9CuYBebwdX4PoYyv107ELUe5PsPWBavzHJ3tMtFuhluTWnPxKJRCKRSCQy/TjQCKt/XX3y/+o6HPJs35XNszPO0WQf+FnQfsnpU+vLUN8MdgNyRtZ2Ncp7wBDYDn4D47MIOes0QpaADeDUWsYe5pql3k3IZd3iPp4H6bjnUI6Cf8B1PYQ0wWCPno5IJBKJnJx83eN2fi7NeYd0jKsvr+A7p3749KzkXd2Ap+9R7qfrflhz/ava45m2I7Rcw+lI3/WtAO+Bx5PsG6+nk+xbv7Q/fWe4gc7ZRPu3oNzK6Hktmfy2r036vc82On44yb4ZHKFzPkL5aZJ9f9hH7Y8y+nbheq9irWOpf0z/L8nUWPmL6TuK6/8Uuhpd6r3sRv8cbszZXZm981HOB5fS/itzdIlYyMzpTa85HYtRv422LTPQ/yjd+/SZudvCr1DcV5Iv6W+HFRXaB988Rte2ugJrHKTPW4vx5akK+MWzvoI++Sb9zvKFriy/m8wbwpxXQL/gDNs5Tb+zTPfiza6sHEa5A3w8jWLgM/j6BePvoOBcM33+v6Hj9zvuQ978lR5ihl/bedM0DvN4vwI+NOvy7/SbCkze51WVRfXaCaJEmdlSm+H4lKLsVE3Kvoe2950tZdcnu5T1rISQKuaHovZNZw26/aKxvn0tS6oUG1WWmbAPvtbGjzPU2WvgV4uoEc7PkQ77MhHoYu1K7YvOVhv7uuJ7/QpdLcKtX2ZPthc1A/tEcK/zbAW+/0rbnqRVAlPuk0gC5b5cv1Q+BbIp8kGnX2VjQmT7bLm/Hfp1RfZ3kAdpGZI3h2iMnZCC47ftj+351WJ06PTLxk6I7OxxWH8rd4RCRHHuKC1DbOaIdJyQAn4vuPpqS8d5HVJUfy+p2lXjihIbuya/L2wowkae3TJEZFfmjywnBshRSl9s9Je1v7z9kL7bPE9Fi+xMlf09Z3Ne2KxNFu8qf2x02ojMD9McrpOLivTX9j6F9l/HfmgbotKnfp9nJCHqffFho0hcxWRNhHTarUI8h94PGx28Pp2xrrZ8SehcFToPhvabvbZ5JkXx4etZd4lZfn0+pIz8oMoRunpsbPgUUZ4NaYu1qcr9vC+2MWsa8yHOPlOxfU7L9Fnkg0t+0dGdZ9O38PGr6nPxwzRWXUX0/JmSN09kU+WPyD8f4jM+ioo7lW1femzuv0iXqi5r8yGq/fBts+gca/M8+orLvOc0RJ7P88c0J/m2L/OFbzfVa5LrXc4WH2NsbJrulcsafa+T99lFVwgpwr7JMy47U3T0FiFF56uQuss4j3gfbOb68sUlB6vOjaLPtrbdkLp9nZmqffcpqnurk4NU+oq8rzIx2Xddv8tel+peydar+htBpIufH0J4O2XFCCu2z0GZayjyDMzLS6Z+yGK1Sjmk7RNbtq91zrXQfumeOb58MdGTtxdlngmyc09nTlmxqfMcmvij67OJXV3R3dOQsZznh6qfkOL80M3BuvtW1B7yY2R+FLG/MsnzVXd+aF9VuUk1xzWudPwy1edzz1x8t9UfyndbHTY2yxTdHOCa92zj3CR+Te6fjzX5Ftf9M/E1VC4yzVehROa77/h09cmXb6Zxm2c3pPjSH9bn/wE="}
},{}],6:[function(require,module,exports){
const types = require("./types");
const typeTrieData = require("./typeTrie.json").data;
const extPictData = require("./extPict.json").data;
const inCBData = require("./inCB.json").data;

const UnicodeTrie = require("unicode-trie");
const Base64 = require("js-base64").Base64;

const typeTrie = new UnicodeTrie(Base64.toUint8Array(typeTrieData));
const extPict = new UnicodeTrie(Base64.toUint8Array(extPictData));
const inCB = new UnicodeTrie(Base64.toUint8Array(inCBData));

function is(type, bit) {
  return (type & bit) !== 0;
}

function nextGraphemeClusterSize(s, ts, start) {
  const L = ts.length;

  for (let i = start; i + 1 < L; i++) {
    const curr = ts[i + 0];
    const next = ts[i + 1];

    // GB9c: \p{InCB=Consonant} [ \p{InCB=Extend} \p{InCB=Linker} ]* \p{InCB=Linker} [ \p{InCB=Extend} \p{InCB=Linker} ]* × \p{InCB=Consonant}
    switch (s.gb9c) {
    case 0:
      if (is(curr, types.InCB_Consonant)) s.gb9c = 1;
      break;
    case 1:
      if (is(curr, types.InCB_Extend)) s.gb9c = 1;
      else if (is(curr, types.InCB_Linker)) s.gb9c = 2;
      else s.gb9c = is(curr, types.InCB_Consonant) ? 1 : 0;
      break;
    case 2:
      if (is(curr, types.InCB_Extend | types.InCB_Linker)) s.gb9c = 2;
      else s.gb9c = is(curr, types.InCB_Consonant) ? 1 : 0;
      break;
    }

    // GB11: \p{Extended_Pictographic} Extend* ZWJ x \p{Extended_Pictographic}
    switch (s.gb11) {
    case 0:
      if (is(curr, types.Extended_Pictographic)) s.gb11 = 1;
      break;
    case 1:
      if (is(curr, types.Extend)) s.gb11 = 1;
      else if (is(curr, types.ZWJ)) s.gb11 = 2;
      else s.gb11 = is(curr, types.Extended_Pictographic) ? 1 : 0;
      break;
    case 2:
      s.gb11 = is(curr, types.Extended_Pictographic) ? 1 : 0;
      break;
    }

    // GB12: sot (RI RI)* RI × RI
    switch (s.gb12) {
    case 0:
      if (is(curr, types.Regional_Indicator)) s.gb12 = 1;
      else s.gb12 = -1;
      break;
    case 1:
      if (is(curr, types.Regional_Indicator)) s.gb12 = 0;
      else s.gb12 = -1;
      break;
    }

    // GB13: [^RI] (RI RI)* RI × RI
    switch (s.gb13) {
    case 0:
      if (!is(curr, types.Regional_Indicator)) s.gb13 = 1;
      break;
    case 1:
      if (is(curr, types.Regional_Indicator)) s.gb13 = 2;
      else s.gb13 = 1;
      break;
    case 2:
      s.gb13 = 1;
      break;
    }

    // GB3: CR x LF
    if (is(curr, types.CR) && is(next, types.LF)) {
      continue;
    }
    // GB4: (Control | CR | LF) ÷
    if (is(curr, types.Control | types.CR | types.LF)) {
      return i + 1 - start;
    }
    // GB5: ÷ (Control | CR | LF)
    if (is(next, types.Control | types.CR | types.LF)) {
      return i + 1 - start;
    }
    // GB6: L x (L | V | LV | LVT)
    if (
      is(curr, types.L) &&
      is(next, types.L | types.V | types.LV | types.LVT)
    ) {
      continue;
    }
    // GB7: (LV | V) x (V | T)
    if (is(curr, types.LV | types.V) && is(next, types.V | types.T)) {
      continue;
    }
    // GB8: (LVT | T) x T
    if (is(curr, types.LVT | types.T) && is(next, types.T)) {
      continue;
    }
    // GB9: x (Extend | ZWJ)
    if (is(next, types.Extend | types.ZWJ)) {
      continue;
    }
    // GB9a: x SpacingMark
    if (is(next, types.SpacingMark)) {
      continue;
    }
    // GB9b: Prepend x
    if (is(curr, types.Prepend)) {
      continue;
    }
    // GB9c: \p{InCB=Consonant} [ \p{InCB=Extend} \p{InCB=Linker} ]* \p{InCB=Linker} [ \p{InCB=Extend} \p{InCB=Linker} ]* × \p{InCB=Consonant}
    if (is(next, types.InCB_Consonant) && s.gb9c === 2) {
      continue;
    }
    // GB11: \p{Extended_Pictographic} Extend* ZWJ x \p{Extended_Pictographic}
    if (is(next, types.Extended_Pictographic) && s.gb11 === 2) {
      continue;
    }
    // GB12: sot (RI RI)* RI x RI
    if (is(next, types.Regional_Indicator) && s.gb12 === 1) {
      continue;
    }
    // GB13: [^RI] (RI RI)* RI x RI
    if (is(next, types.Regional_Indicator) && s.gb13 === 2) {
      continue;
    }
    // GB999: Any ÷ Any
    return i + 1 - start;
  }
  return L - start;
}

module.exports = function split(str) {
  const graphemeClusters = [];

  const map = [0];
  const ts = [];
  for (let i = 0; i < str.length; ) {
    const code = str.codePointAt(i);
    ts.push(typeTrie.get(code) | extPict.get(code) | inCB.get(code));
    i += code > 65535 ? 2 : 1;
    map.push(i);
  }
  const s = {
    gb9c: 0,
    gb11: 0,
    gb12: 0,
    gb13: 0,
  };
  for (let offset = 0; offset < ts.length; ) {
    const size = nextGraphemeClusterSize(s, ts, offset);
    const start = map[offset];
    const end = map[offset + size];
    graphemeClusters.push(str.slice(start, end));
    offset += size;
  }

  return graphemeClusters;
};

},{"./extPict.json":4,"./inCB.json":5,"./typeTrie.json":7,"./types":8,"js-base64":10,"unicode-trie":12}],7:[function(require,module,exports){
module.exports={"data":"ABAOAAAAAADQjQAAAd4HIfjtnG2oFUUYxx/1nHu29OolvKRSZIIQghSSEFJwwj4YWdzoFcoQyriBHwz8YHDBiSKDLG9YKSEiUX4IFQ0FCaRLoFmUb9mLBqJ+EDOIsAgpjf7b7nCnOTO7M7szu8frPPBjZufleZ6ZeWZm73pwYALRk2ApGAQMvC6UlU2HwUbwDthk0P5DsC2jfifYC0bAQXAE/AhOgXNCu1/A7+ASoAZRD5gMekE/mAFmge1gN9jbSPrOSdPPkM4DX4AvwVFwApwBZ8EFcBH8Bf4GE5pEUXP0uQ/5ac2k/UyktzWT/ncgPYj0rmZip91M6hc1R/U/hPzj4BnwPBgECwT7cb8VKFsZJflVyK9O9cW8gvwb6fM6pO+l+c1It4Lt4Hah/R7k94H94BuhPGZDNMqWlK1gf4rYNovthu1c8x3G8xOYmhKXnUH6c5pf0/h/+8Uo/1Wagz+bev1X0rpGD9GkniS/FjRTvVNRdiO4BcwGc8H8tN3dabqwp1Pv/Sh7WFHOGU4pOz9vws/1qa+PCuXxGHZmjDtQAdL6n1DEgAs7NwnrvCQj5gKBQCAQCAQCgUAgEOgGnsPfrlOE7zlvG3y/WI4+K4W/eYciotVgCGWv8u85SNeDjVHyPXAj8tORbknrtyLdAT5Jnz9Fehnp5zl/S3+F+kPQeRgcAUfBMfAtOB6FulAX6kJdqHNdtwPsAQei+u+sQCAwdjnk+d9TNk0Y/Xd1mUFFmfh+vKHhxycbRnoTaDLR0t582mg3oGg7LJWN4JmmoD1YNSUp24b0NJjWR3QnGAT3TcT7Pzh7HdGt1xNF4xKeFvIiu9D25ER1nczqVMeMSUS7kX8M6bvgMKBeMx2BQCAQGJv8gXuhEd8nLaJ/cB+2cCdPaiW/E2ojvyi9oyOkN6B8Df5mmZbW34x0QLjDZ7eS707i/Rr/ZmRua/R3ZPORv6eV1C2MU/R/MP1O9gCeH2mN9n0K+Wdb+rt7EHUrhPpVreS7GH9mQt1ryL+VoWt9Rl3MEuhdJr2vvI8+H4CPwQuo25XqeLHAe81ewf4I8gckf77G80up3uM5voqcRNuX0e800vMW/XwyBH7rEl9EZiC2n6jQ3masyxzY/EHxnXjeVfptIP797rAAkxjO4KNGZ/trjTJz/33O33rTpXPpVBf+1u4cfLqg8Wuxo9+Dnk/1XzQc/6W03RWhrD+dSzI4x+K/eS914Xnnisvp2MY7OrP2ldAToe86MFnQ0X+VnqU2xOfnrCh5f3Oha0GUpPciXQQGrqY5hK9LBX+nK/aebaweS8+AZSXnIa9/v4MzTh7b2jH6O/rlJdfiZBeMoUFmjBfy4wz7mBCkPgnz7y6Oq4x/l+sWXeO4lKrsdJvUvYZF111MdfmxLm0NpmI7591853Tj+VJVDGaNoZ3TRtahautDRL/qkm6KlW6Wa2EeXI3N5Ry0SX+e26xJ27K9K5iijNJyjvwsnllZ4mKeZbuy72I5F5VvNr6o+hcVbredoVc3/y7vN/keke0ywS6T6tqOfOE2mQKS8rJ/3A8mpHWfZVl7qq0oV0lbQ9m9bOszt+lb5LWsU8TxN8j9+LnOPnL3Pc73tz4X31fy7mVdDObZcnHfdev3VNV86ebRtF1VUsSui7U0OQ/rEvE8Jsp+j1H5Lbfnecrpa+Nf1XEi2mZUz/qIe4b7oJtDXi8/m85bN69HJOXr2i9Z+0PVVuW36n5x6V8Z/Yw640s+t5nQlpGfOPAdX2XPI5d+iP6wDJ8YFdvfRc/bOkR31jKpXHx2eb7J91kd7yaMOseb9w6Vp7PO9YyFUWeMM6pvfC7mhBXoI78z1SnyfDPLvqoyRp1nmNieZeAqRlUxV+Ssz3vvdSWm/paJ87ruuipsyTGmssfI3X4zWSMVTFNOlD1PNjbK+OeKsmI6b/J4mdTWp+TZ8jkfRXXEwgz0lPXZx9z7PruqOhdNYlqMZR2qeHe1N33OQdYYVeWyiG3l/rKeKteS2/UhXDdP885CMaWcPqbzaBJTOt1ViqnPjOqJmSzxcbfWtQ6iMNLPv6tx5om8fxh1niUu/GA5mMalq3lQnQ+25PmtspnlDxdRrwupaw/7WCvb9VLpynrWlbkURp17zrcPjNT7rSopsr9cnX95+861PRN/bM8Y1/YZmd0//Fmnp0oxvRvk5yJ2TNqwArpdiY+Y4Kk8b1nzWGSOGZnFF29nK1ynHAuiraK6XUudPlRh2+ZM1d3xJnp9S9H3Op2OKu4Xn7qrfn9gVO+Za3oe6vrq7vWq3z24Py6Fkf59Qjd2VzZ0dnXC62x89iGi7xwuumebc8ZUZFum81BlvKoka+19+cLIPGZU7fizT3GlP29+xfEwKa864+oUk3OCkXp9maJtFeLaJqNisctTG9HFRh13XZaoxmd6T7sWRuZz5Ssus3zgIseI2F7WVbWYzFsVsWZzT5veHWVE1qWaj7w4cyWma6TyMW8cTJP37bvchqQ6Gx+YAlkfL/exPqIt0b5r4brz5lPVzqfo9GfZLRrTNmMx1cfIz5z5Pkd9ntfyvilCnv6y/tr2q+ouM/WhbPyX2UNFdPqSqs6pLLuucWXLZAw24/UlOt9dzqELn1z5Zrtv8uz6EF82ZlaEK2FU7vtpXcIsydJRhbCa+e8/D60bUcbXTMMzfRK24nKssvgYr+x71lh8iO/1tBl/LPGlIseAT6q2J8m/"}
},{}],8:[function(require,module,exports){
module.exports = {
  Other: 0,
  CR: 1 << 0,
  LF: 1 << 1,
  Control: 1 << 2,
  Extend: 1 << 3,
  ZWJ: 1 << 4,
  Regional_Indicator: 1 << 5,
  Prepend: 1 << 6,
  SpacingMark: 1 << 7,
  L: 1 << 8,
  V: 1 << 9,
  T: 1 << 10,
  LV: 1 << 11,
  LVT: 1 << 12,
  Extended_Pictographic: 1 << 13,
  InCB_Linker: 1 << 14,
  InCB_Consonant: 1 << 15,
  InCB_Extend: 1 << 16,
};

},{}],9:[function(require,module,exports){
/*! ieee754. BSD-3-Clause License. Feross Aboukhadijeh <https://feross.org/opensource> */
exports.read = function (buffer, offset, isLE, mLen, nBytes) {
  var e, m
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var nBits = -7
  var i = isLE ? (nBytes - 1) : 0
  var d = isLE ? -1 : 1
  var s = buffer[offset + i]

  i += d

  e = s & ((1 << (-nBits)) - 1)
  s >>= (-nBits)
  nBits += eLen
  for (; nBits > 0; e = (e * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  m = e & ((1 << (-nBits)) - 1)
  e >>= (-nBits)
  nBits += mLen
  for (; nBits > 0; m = (m * 256) + buffer[offset + i], i += d, nBits -= 8) {}

  if (e === 0) {
    e = 1 - eBias
  } else if (e === eMax) {
    return m ? NaN : ((s ? -1 : 1) * Infinity)
  } else {
    m = m + Math.pow(2, mLen)
    e = e - eBias
  }
  return (s ? -1 : 1) * m * Math.pow(2, e - mLen)
}

exports.write = function (buffer, value, offset, isLE, mLen, nBytes) {
  var e, m, c
  var eLen = (nBytes * 8) - mLen - 1
  var eMax = (1 << eLen) - 1
  var eBias = eMax >> 1
  var rt = (mLen === 23 ? Math.pow(2, -24) - Math.pow(2, -77) : 0)
  var i = isLE ? 0 : (nBytes - 1)
  var d = isLE ? 1 : -1
  var s = value < 0 || (value === 0 && 1 / value < 0) ? 1 : 0

  value = Math.abs(value)

  if (isNaN(value) || value === Infinity) {
    m = isNaN(value) ? 1 : 0
    e = eMax
  } else {
    e = Math.floor(Math.log(value) / Math.LN2)
    if (value * (c = Math.pow(2, -e)) < 1) {
      e--
      c *= 2
    }
    if (e + eBias >= 1) {
      value += rt / c
    } else {
      value += rt * Math.pow(2, 1 - eBias)
    }
    if (value * c >= 2) {
      e++
      c /= 2
    }

    if (e + eBias >= eMax) {
      m = 0
      e = eMax
    } else if (e + eBias >= 1) {
      m = ((value * c) - 1) * Math.pow(2, mLen)
      e = e + eBias
    } else {
      m = value * Math.pow(2, eBias - 1) * Math.pow(2, mLen)
      e = 0
    }
  }

  for (; mLen >= 8; buffer[offset + i] = m & 0xff, i += d, m /= 256, mLen -= 8) {}

  e = (e << mLen) | m
  eLen += mLen
  for (; eLen > 0; buffer[offset + i] = e & 0xff, i += d, e /= 256, eLen -= 8) {}

  buffer[offset + i - d] |= s * 128
}

},{}],10:[function(require,module,exports){
(function (global,Buffer){(function (){
//
// THIS FILE IS AUTOMATICALLY GENERATED! DO NOT EDIT BY HAND!
//
;
(function (global, factory) {
    typeof exports === 'object' && typeof module !== 'undefined'
        ? module.exports = factory()
        : typeof define === 'function' && define.amd
            ? define(factory) :
            // cf. https://github.com/dankogai/js-base64/issues/119
            (function () {
                // existing version for noConflict()
                var _Base64 = global.Base64;
                var gBase64 = factory();
                gBase64.noConflict = function () {
                    global.Base64 = _Base64;
                    return gBase64;
                };
                if (global.Meteor) { // Meteor.js
                    Base64 = gBase64;
                }
                global.Base64 = gBase64;
            })();
}((typeof self !== 'undefined' ? self
    : typeof window !== 'undefined' ? window
        : typeof global !== 'undefined' ? global
            : this), function () {
    'use strict';
    /**
     *  base64.ts
     *
     *  Licensed under the BSD 3-Clause License.
     *    http://opensource.org/licenses/BSD-3-Clause
     *
     *  References:
     *    http://en.wikipedia.org/wiki/Base64
     *
     * @author Dan Kogai (https://github.com/dankogai)
     */
    var version = '3.7.8';
    /**
     * @deprecated use lowercase `version`.
     */
    var VERSION = version;
    var _hasBuffer = typeof Buffer === 'function';
    var _TD = typeof TextDecoder === 'function' ? new TextDecoder() : undefined;
    var _TE = typeof TextEncoder === 'function' ? new TextEncoder() : undefined;
    var b64ch = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/=';
    var b64chs = Array.prototype.slice.call(b64ch);
    var b64tab = (function (a) {
        var tab = {};
        a.forEach(function (c, i) { return tab[c] = i; });
        return tab;
    })(b64chs);
    var b64re = /^(?:[A-Za-z\d+\/]{4})*?(?:[A-Za-z\d+\/]{2}(?:==)?|[A-Za-z\d+\/]{3}=?)?$/;
    var _fromCC = String.fromCharCode.bind(String);
    var _U8Afrom = typeof Uint8Array.from === 'function'
        ? Uint8Array.from.bind(Uint8Array)
        : function (it) { return new Uint8Array(Array.prototype.slice.call(it, 0)); };
    var _mkUriSafe = function (src) { return src
        .replace(/=/g, '').replace(/[+\/]/g, function (m0) { return m0 == '+' ? '-' : '_'; }); };
    var _tidyB64 = function (s) { return s.replace(/[^A-Za-z0-9\+\/]/g, ''); };
    /**
     * polyfill version of `btoa`
     */
    var btoaPolyfill = function (bin) {
        // console.log('polyfilled');
        var u32, c0, c1, c2, asc = '';
        var pad = bin.length % 3;
        for (var i = 0; i < bin.length;) {
            if ((c0 = bin.charCodeAt(i++)) > 255 ||
                (c1 = bin.charCodeAt(i++)) > 255 ||
                (c2 = bin.charCodeAt(i++)) > 255)
                throw new TypeError('invalid character found');
            u32 = (c0 << 16) | (c1 << 8) | c2;
            asc += b64chs[u32 >> 18 & 63]
                + b64chs[u32 >> 12 & 63]
                + b64chs[u32 >> 6 & 63]
                + b64chs[u32 & 63];
        }
        return pad ? asc.slice(0, pad - 3) + "===".substring(pad) : asc;
    };
    /**
     * does what `window.btoa` of web browsers do.
     * @param {String} bin binary string
     * @returns {string} Base64-encoded string
     */
    var _btoa = typeof btoa === 'function' ? function (bin) { return btoa(bin); }
        : _hasBuffer ? function (bin) { return Buffer.from(bin, 'binary').toString('base64'); }
            : btoaPolyfill;
    var _fromUint8Array = _hasBuffer
        ? function (u8a) { return Buffer.from(u8a).toString('base64'); }
        : function (u8a) {
            // cf. https://stackoverflow.com/questions/12710001/how-to-convert-uint8-array-to-base64-encoded-string/12713326#12713326
            var maxargs = 0x1000;
            var strs = [];
            for (var i = 0, l = u8a.length; i < l; i += maxargs) {
                strs.push(_fromCC.apply(null, u8a.subarray(i, i + maxargs)));
            }
            return _btoa(strs.join(''));
        };
    /**
     * converts a Uint8Array to a Base64 string.
     * @param {boolean} [urlsafe] URL-and-filename-safe a la RFC4648 §5
     * @returns {string} Base64 string
     */
    var fromUint8Array = function (u8a, urlsafe) {
        if (urlsafe === void 0) { urlsafe = false; }
        return urlsafe ? _mkUriSafe(_fromUint8Array(u8a)) : _fromUint8Array(u8a);
    };
    // This trick is found broken https://github.com/dankogai/js-base64/issues/130
    // const utob = (src: string) => unescape(encodeURIComponent(src));
    // reverting good old fationed regexp
    var cb_utob = function (c) {
        if (c.length < 2) {
            var cc = c.charCodeAt(0);
            return cc < 0x80 ? c
                : cc < 0x800 ? (_fromCC(0xc0 | (cc >>> 6))
                    + _fromCC(0x80 | (cc & 0x3f)))
                    : (_fromCC(0xe0 | ((cc >>> 12) & 0x0f))
                        + _fromCC(0x80 | ((cc >>> 6) & 0x3f))
                        + _fromCC(0x80 | (cc & 0x3f)));
        }
        else {
            var cc = 0x10000
                + (c.charCodeAt(0) - 0xD800) * 0x400
                + (c.charCodeAt(1) - 0xDC00);
            return (_fromCC(0xf0 | ((cc >>> 18) & 0x07))
                + _fromCC(0x80 | ((cc >>> 12) & 0x3f))
                + _fromCC(0x80 | ((cc >>> 6) & 0x3f))
                + _fromCC(0x80 | (cc & 0x3f)));
        }
    };
    var re_utob = /[\uD800-\uDBFF][\uDC00-\uDFFFF]|[^\x00-\x7F]/g;
    /**
     * @deprecated should have been internal use only.
     * @param {string} src UTF-8 string
     * @returns {string} UTF-16 string
     */
    var utob = function (u) { return u.replace(re_utob, cb_utob); };
    //
    var _encode = _hasBuffer
        ? function (s) { return Buffer.from(s, 'utf8').toString('base64'); }
        : _TE
            ? function (s) { return _fromUint8Array(_TE.encode(s)); }
            : function (s) { return _btoa(utob(s)); };
    /**
     * converts a UTF-8-encoded string to a Base64 string.
     * @param {boolean} [urlsafe] if `true` make the result URL-safe
     * @returns {string} Base64 string
     */
    var encode = function (src, urlsafe) {
        if (urlsafe === void 0) { urlsafe = false; }
        return urlsafe
            ? _mkUriSafe(_encode(src))
            : _encode(src);
    };
    /**
     * converts a UTF-8-encoded string to URL-safe Base64 RFC4648 §5.
     * @returns {string} Base64 string
     */
    var encodeURI = function (src) { return encode(src, true); };
    // This trick is found broken https://github.com/dankogai/js-base64/issues/130
    // const btou = (src: string) => decodeURIComponent(escape(src));
    // reverting good old fationed regexp
    var re_btou = /[\xC0-\xDF][\x80-\xBF]|[\xE0-\xEF][\x80-\xBF]{2}|[\xF0-\xF7][\x80-\xBF]{3}/g;
    var cb_btou = function (cccc) {
        switch (cccc.length) {
            case 4:
                var cp = ((0x07 & cccc.charCodeAt(0)) << 18)
                    | ((0x3f & cccc.charCodeAt(1)) << 12)
                    | ((0x3f & cccc.charCodeAt(2)) << 6)
                    | (0x3f & cccc.charCodeAt(3)), offset = cp - 0x10000;
                return (_fromCC((offset >>> 10) + 0xD800)
                    + _fromCC((offset & 0x3FF) + 0xDC00));
            case 3:
                return _fromCC(((0x0f & cccc.charCodeAt(0)) << 12)
                    | ((0x3f & cccc.charCodeAt(1)) << 6)
                    | (0x3f & cccc.charCodeAt(2)));
            default:
                return _fromCC(((0x1f & cccc.charCodeAt(0)) << 6)
                    | (0x3f & cccc.charCodeAt(1)));
        }
    };
    /**
     * @deprecated should have been internal use only.
     * @param {string} src UTF-16 string
     * @returns {string} UTF-8 string
     */
    var btou = function (b) { return b.replace(re_btou, cb_btou); };
    /**
     * polyfill version of `atob`
     */
    var atobPolyfill = function (asc) {
        // console.log('polyfilled');
        asc = asc.replace(/\s+/g, '');
        if (!b64re.test(asc))
            throw new TypeError('malformed base64.');
        asc += '=='.slice(2 - (asc.length & 3));
        var u24, r1, r2;
        var binArray = []; // use array to avoid minor gc in loop
        for (var i = 0; i < asc.length;) {
            u24 = b64tab[asc.charAt(i++)] << 18
                | b64tab[asc.charAt(i++)] << 12
                | (r1 = b64tab[asc.charAt(i++)]) << 6
                | (r2 = b64tab[asc.charAt(i++)]);
            if (r1 === 64) {
                binArray.push(_fromCC(u24 >> 16 & 255));
            }
            else if (r2 === 64) {
                binArray.push(_fromCC(u24 >> 16 & 255, u24 >> 8 & 255));
            }
            else {
                binArray.push(_fromCC(u24 >> 16 & 255, u24 >> 8 & 255, u24 & 255));
            }
        }
        return binArray.join('');
    };
    /**
     * does what `window.atob` of web browsers do.
     * @param {String} asc Base64-encoded string
     * @returns {string} binary string
     */
    var _atob = typeof atob === 'function' ? function (asc) { return atob(_tidyB64(asc)); }
        : _hasBuffer ? function (asc) { return Buffer.from(asc, 'base64').toString('binary'); }
            : atobPolyfill;
    //
    var _toUint8Array = _hasBuffer
        ? function (a) { return _U8Afrom(Buffer.from(a, 'base64')); }
        : function (a) { return _U8Afrom(_atob(a).split('').map(function (c) { return c.charCodeAt(0); })); };
    /**
     * converts a Base64 string to a Uint8Array.
     */
    var toUint8Array = function (a) { return _toUint8Array(_unURI(a)); };
    //
    var _decode = _hasBuffer
        ? function (a) { return Buffer.from(a, 'base64').toString('utf8'); }
        : _TD
            ? function (a) { return _TD.decode(_toUint8Array(a)); }
            : function (a) { return btou(_atob(a)); };
    var _unURI = function (a) { return _tidyB64(a.replace(/[-_]/g, function (m0) { return m0 == '-' ? '+' : '/'; })); };
    /**
     * converts a Base64 string to a UTF-8 string.
     * @param {String} src Base64 string.  Both normal and URL-safe are supported
     * @returns {string} UTF-8 string
     */
    var decode = function (src) { return _decode(_unURI(src)); };
    /**
     * check if a value is a valid Base64 string
     * @param {String} src a value to check
      */
    var isValid = function (src) {
        if (typeof src !== 'string')
            return false;
        var s = src.replace(/\s+/g, '').replace(/={0,2}$/, '');
        return !/[^\s0-9a-zA-Z\+/]/.test(s) || !/[^\s0-9a-zA-Z\-_]/.test(s);
    };
    //
    var _noEnum = function (v) {
        return {
            value: v, enumerable: false, writable: true, configurable: true
        };
    };
    /**
     * extend String.prototype with relevant methods
     */
    var extendString = function () {
        var _add = function (name, body) { return Object.defineProperty(String.prototype, name, _noEnum(body)); };
        _add('fromBase64', function () { return decode(this); });
        _add('toBase64', function (urlsafe) { return encode(this, urlsafe); });
        _add('toBase64URI', function () { return encode(this, true); });
        _add('toBase64URL', function () { return encode(this, true); });
        _add('toUint8Array', function () { return toUint8Array(this); });
    };
    /**
     * extend Uint8Array.prototype with relevant methods
     */
    var extendUint8Array = function () {
        var _add = function (name, body) { return Object.defineProperty(Uint8Array.prototype, name, _noEnum(body)); };
        _add('toBase64', function (urlsafe) { return fromUint8Array(this, urlsafe); });
        _add('toBase64URI', function () { return fromUint8Array(this, true); });
        _add('toBase64URL', function () { return fromUint8Array(this, true); });
    };
    /**
     * extend Builtin prototypes with relevant methods
     */
    var extendBuiltins = function () {
        extendString();
        extendUint8Array();
    };
    var gBase64 = {
        version: version,
        VERSION: VERSION,
        atob: _atob,
        atobPolyfill: atobPolyfill,
        btoa: _btoa,
        btoaPolyfill: btoaPolyfill,
        fromBase64: decode,
        toBase64: encode,
        encode: encode,
        encodeURI: encodeURI,
        encodeURL: encodeURI,
        utob: utob,
        btou: btou,
        decode: decode,
        isValid: isValid,
        fromUint8Array: fromUint8Array,
        toUint8Array: toUint8Array,
        extendString: extendString,
        extendUint8Array: extendUint8Array,
        extendBuiltins: extendBuiltins
    };
    //
    // export Base64 to the namespace
    //
    // ES5 is yet to have Object.assign() that may make transpilers unhappy.
    // gBase64.Base64 = Object.assign({}, gBase64);
    gBase64.Base64 = {};
    Object.keys(gBase64).forEach(function (k) { return gBase64.Base64[k] = gBase64[k]; });
    return gBase64;
}));

}).call(this)}).call(this,typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : typeof window !== "undefined" ? window : {},require("buffer").Buffer)
},{"buffer":2}],11:[function(require,module,exports){
var TINF_OK = 0;
var TINF_DATA_ERROR = -3;

function Tree() {
  this.table = new Uint16Array(16);   /* table of code length counts */
  this.trans = new Uint16Array(288);  /* code -> symbol translation table */
}

function Data(source, dest) {
  this.source = source;
  this.sourceIndex = 0;
  this.tag = 0;
  this.bitcount = 0;
  
  this.dest = dest;
  this.destLen = 0;
  
  this.ltree = new Tree();  /* dynamic length/symbol tree */
  this.dtree = new Tree();  /* dynamic distance tree */
}

/* --------------------------------------------------- *
 * -- uninitialized global data (static structures) -- *
 * --------------------------------------------------- */

var sltree = new Tree();
var sdtree = new Tree();

/* extra bits and base tables for length codes */
var length_bits = new Uint8Array(30);
var length_base = new Uint16Array(30);

/* extra bits and base tables for distance codes */
var dist_bits = new Uint8Array(30);
var dist_base = new Uint16Array(30);

/* special ordering of code length codes */
var clcidx = new Uint8Array([
  16, 17, 18, 0, 8, 7, 9, 6,
  10, 5, 11, 4, 12, 3, 13, 2,
  14, 1, 15
]);

/* used by tinf_decode_trees, avoids allocations every call */
var code_tree = new Tree();
var lengths = new Uint8Array(288 + 32);

/* ----------------------- *
 * -- utility functions -- *
 * ----------------------- */

/* build extra bits and base tables */
function tinf_build_bits_base(bits, base, delta, first) {
  var i, sum;

  /* build bits table */
  for (i = 0; i < delta; ++i) bits[i] = 0;
  for (i = 0; i < 30 - delta; ++i) bits[i + delta] = i / delta | 0;

  /* build base table */
  for (sum = first, i = 0; i < 30; ++i) {
    base[i] = sum;
    sum += 1 << bits[i];
  }
}

/* build the fixed huffman trees */
function tinf_build_fixed_trees(lt, dt) {
  var i;

  /* build fixed length tree */
  for (i = 0; i < 7; ++i) lt.table[i] = 0;

  lt.table[7] = 24;
  lt.table[8] = 152;
  lt.table[9] = 112;

  for (i = 0; i < 24; ++i) lt.trans[i] = 256 + i;
  for (i = 0; i < 144; ++i) lt.trans[24 + i] = i;
  for (i = 0; i < 8; ++i) lt.trans[24 + 144 + i] = 280 + i;
  for (i = 0; i < 112; ++i) lt.trans[24 + 144 + 8 + i] = 144 + i;

  /* build fixed distance tree */
  for (i = 0; i < 5; ++i) dt.table[i] = 0;

  dt.table[5] = 32;

  for (i = 0; i < 32; ++i) dt.trans[i] = i;
}

/* given an array of code lengths, build a tree */
var offs = new Uint16Array(16);

function tinf_build_tree(t, lengths, off, num) {
  var i, sum;

  /* clear code length count table */
  for (i = 0; i < 16; ++i) t.table[i] = 0;

  /* scan symbol lengths, and sum code length counts */
  for (i = 0; i < num; ++i) t.table[lengths[off + i]]++;

  t.table[0] = 0;

  /* compute offset table for distribution sort */
  for (sum = 0, i = 0; i < 16; ++i) {
    offs[i] = sum;
    sum += t.table[i];
  }

  /* create code->symbol translation table (symbols sorted by code) */
  for (i = 0; i < num; ++i) {
    if (lengths[off + i]) t.trans[offs[lengths[off + i]]++] = i;
  }
}

/* ---------------------- *
 * -- decode functions -- *
 * ---------------------- */

/* get one bit from source stream */
function tinf_getbit(d) {
  /* check if tag is empty */
  if (!d.bitcount--) {
    /* load next tag */
    d.tag = d.source[d.sourceIndex++];
    d.bitcount = 7;
  }

  /* shift bit out of tag */
  var bit = d.tag & 1;
  d.tag >>>= 1;

  return bit;
}

/* read a num bit value from a stream and add base */
function tinf_read_bits(d, num, base) {
  if (!num)
    return base;

  while (d.bitcount < 24) {
    d.tag |= d.source[d.sourceIndex++] << d.bitcount;
    d.bitcount += 8;
  }

  var val = d.tag & (0xffff >>> (16 - num));
  d.tag >>>= num;
  d.bitcount -= num;
  return val + base;
}

/* given a data stream and a tree, decode a symbol */
function tinf_decode_symbol(d, t) {
  while (d.bitcount < 24) {
    d.tag |= d.source[d.sourceIndex++] << d.bitcount;
    d.bitcount += 8;
  }
  
  var sum = 0, cur = 0, len = 0;
  var tag = d.tag;

  /* get more bits while code value is above sum */
  do {
    cur = 2 * cur + (tag & 1);
    tag >>>= 1;
    ++len;

    sum += t.table[len];
    cur -= t.table[len];
  } while (cur >= 0);
  
  d.tag = tag;
  d.bitcount -= len;

  return t.trans[sum + cur];
}

/* given a data stream, decode dynamic trees from it */
function tinf_decode_trees(d, lt, dt) {
  var hlit, hdist, hclen;
  var i, num, length;

  /* get 5 bits HLIT (257-286) */
  hlit = tinf_read_bits(d, 5, 257);

  /* get 5 bits HDIST (1-32) */
  hdist = tinf_read_bits(d, 5, 1);

  /* get 4 bits HCLEN (4-19) */
  hclen = tinf_read_bits(d, 4, 4);

  for (i = 0; i < 19; ++i) lengths[i] = 0;

  /* read code lengths for code length alphabet */
  for (i = 0; i < hclen; ++i) {
    /* get 3 bits code length (0-7) */
    var clen = tinf_read_bits(d, 3, 0);
    lengths[clcidx[i]] = clen;
  }

  /* build code length tree */
  tinf_build_tree(code_tree, lengths, 0, 19);

  /* decode code lengths for the dynamic trees */
  for (num = 0; num < hlit + hdist;) {
    var sym = tinf_decode_symbol(d, code_tree);

    switch (sym) {
      case 16:
        /* copy previous code length 3-6 times (read 2 bits) */
        var prev = lengths[num - 1];
        for (length = tinf_read_bits(d, 2, 3); length; --length) {
          lengths[num++] = prev;
        }
        break;
      case 17:
        /* repeat code length 0 for 3-10 times (read 3 bits) */
        for (length = tinf_read_bits(d, 3, 3); length; --length) {
          lengths[num++] = 0;
        }
        break;
      case 18:
        /* repeat code length 0 for 11-138 times (read 7 bits) */
        for (length = tinf_read_bits(d, 7, 11); length; --length) {
          lengths[num++] = 0;
        }
        break;
      default:
        /* values 0-15 represent the actual code lengths */
        lengths[num++] = sym;
        break;
    }
  }

  /* build dynamic trees */
  tinf_build_tree(lt, lengths, 0, hlit);
  tinf_build_tree(dt, lengths, hlit, hdist);
}

/* ----------------------------- *
 * -- block inflate functions -- *
 * ----------------------------- */

/* given a stream and two trees, inflate a block of data */
function tinf_inflate_block_data(d, lt, dt) {
  while (1) {
    var sym = tinf_decode_symbol(d, lt);

    /* check for end of block */
    if (sym === 256) {
      return TINF_OK;
    }

    if (sym < 256) {
      d.dest[d.destLen++] = sym;
    } else {
      var length, dist, offs;
      var i;

      sym -= 257;

      /* possibly get more bits from length code */
      length = tinf_read_bits(d, length_bits[sym], length_base[sym]);

      dist = tinf_decode_symbol(d, dt);

      /* possibly get more bits from distance code */
      offs = d.destLen - tinf_read_bits(d, dist_bits[dist], dist_base[dist]);

      /* copy match */
      for (i = offs; i < offs + length; ++i) {
        d.dest[d.destLen++] = d.dest[i];
      }
    }
  }
}

/* inflate an uncompressed block of data */
function tinf_inflate_uncompressed_block(d) {
  var length, invlength;
  var i;
  
  /* unread from bitbuffer */
  while (d.bitcount > 8) {
    d.sourceIndex--;
    d.bitcount -= 8;
  }

  /* get length */
  length = d.source[d.sourceIndex + 1];
  length = 256 * length + d.source[d.sourceIndex];

  /* get one's complement of length */
  invlength = d.source[d.sourceIndex + 3];
  invlength = 256 * invlength + d.source[d.sourceIndex + 2];

  /* check length */
  if (length !== (~invlength & 0x0000ffff))
    return TINF_DATA_ERROR;

  d.sourceIndex += 4;

  /* copy block */
  for (i = length; i; --i)
    d.dest[d.destLen++] = d.source[d.sourceIndex++];

  /* make sure we start next block on a byte boundary */
  d.bitcount = 0;

  return TINF_OK;
}

/* inflate stream from source to dest */
function tinf_uncompress(source, dest) {
  var d = new Data(source, dest);
  var bfinal, btype, res;

  do {
    /* read final block flag */
    bfinal = tinf_getbit(d);

    /* read block type (2 bits) */
    btype = tinf_read_bits(d, 2, 0);

    /* decompress block */
    switch (btype) {
      case 0:
        /* decompress uncompressed block */
        res = tinf_inflate_uncompressed_block(d);
        break;
      case 1:
        /* decompress block with fixed huffman trees */
        res = tinf_inflate_block_data(d, sltree, sdtree);
        break;
      case 2:
        /* decompress block with dynamic huffman trees */
        tinf_decode_trees(d, d.ltree, d.dtree);
        res = tinf_inflate_block_data(d, d.ltree, d.dtree);
        break;
      default:
        res = TINF_DATA_ERROR;
    }

    if (res !== TINF_OK)
      throw new Error('Data error');

  } while (!bfinal);

  if (d.destLen < d.dest.length) {
    if (typeof d.dest.slice === 'function')
      return d.dest.slice(0, d.destLen);
    else
      return d.dest.subarray(0, d.destLen);
  }
  
  return d.dest;
}

/* -------------------- *
 * -- initialization -- *
 * -------------------- */

/* build fixed huffman trees */
tinf_build_fixed_trees(sltree, sdtree);

/* build extra bits and base tables */
tinf_build_bits_base(length_bits, length_base, 4, 3);
tinf_build_bits_base(dist_bits, dist_base, 2, 1);

/* fix a special case */
length_bits[28] = 0;
length_base[28] = 258;

module.exports = tinf_uncompress;

},{}],12:[function(require,module,exports){
const inflate = require('tiny-inflate');
const { swap32LE } = require('./swap');

// Shift size for getting the index-1 table offset.
const SHIFT_1 = 6 + 5;

// Shift size for getting the index-2 table offset.
const SHIFT_2 = 5;

// Difference between the two shift sizes,
// for getting an index-1 offset from an index-2 offset. 6=11-5
const SHIFT_1_2 = SHIFT_1 - SHIFT_2;

// Number of index-1 entries for the BMP. 32=0x20
// This part of the index-1 table is omitted from the serialized form.
const OMITTED_BMP_INDEX_1_LENGTH = 0x10000 >> SHIFT_1;

// Number of entries in an index-2 block. 64=0x40
const INDEX_2_BLOCK_LENGTH = 1 << SHIFT_1_2;

// Mask for getting the lower bits for the in-index-2-block offset. */
const INDEX_2_MASK = INDEX_2_BLOCK_LENGTH - 1;

// Shift size for shifting left the index array values.
// Increases possible data size with 16-bit index values at the cost
// of compactability.
// This requires data blocks to be aligned by DATA_GRANULARITY.
const INDEX_SHIFT = 2;

// Number of entries in a data block. 32=0x20
const DATA_BLOCK_LENGTH = 1 << SHIFT_2;

// Mask for getting the lower bits for the in-data-block offset.
const DATA_MASK = DATA_BLOCK_LENGTH - 1;

// The part of the index-2 table for U+D800..U+DBFF stores values for
// lead surrogate code _units_ not code _points_.
// Values for lead surrogate code _points_ are indexed with this portion of the table.
// Length=32=0x20=0x400>>SHIFT_2. (There are 1024=0x400 lead surrogates.)
const LSCP_INDEX_2_OFFSET = 0x10000 >> SHIFT_2;
const LSCP_INDEX_2_LENGTH = 0x400 >> SHIFT_2;

// Count the lengths of both BMP pieces. 2080=0x820
const INDEX_2_BMP_LENGTH = LSCP_INDEX_2_OFFSET + LSCP_INDEX_2_LENGTH;

// The 2-byte UTF-8 version of the index-2 table follows at offset 2080=0x820.
// Length 32=0x20 for lead bytes C0..DF, regardless of SHIFT_2.
const UTF8_2B_INDEX_2_OFFSET = INDEX_2_BMP_LENGTH;
const UTF8_2B_INDEX_2_LENGTH = 0x800 >> 6;  // U+0800 is the first code point after 2-byte UTF-8

// The index-1 table, only used for supplementary code points, at offset 2112=0x840.
// Variable length, for code points up to highStart, where the last single-value range starts.
// Maximum length 512=0x200=0x100000>>SHIFT_1.
// (For 0x100000 supplementary code points U+10000..U+10ffff.)
//
// The part of the index-2 table for supplementary code points starts
// after this index-1 table.
//
// Both the index-1 table and the following part of the index-2 table
// are omitted completely if there is only BMP data.
const INDEX_1_OFFSET = UTF8_2B_INDEX_2_OFFSET + UTF8_2B_INDEX_2_LENGTH;

// The alignment size of a data block. Also the granularity for compaction.
const DATA_GRANULARITY = 1 << INDEX_SHIFT;

class UnicodeTrie {
  constructor(data) {
    const isBuffer = (typeof data.readUInt32BE === 'function') && (typeof data.slice === 'function');

    if (isBuffer || data instanceof Uint8Array) {
      // read binary format
      let uncompressedLength;
      if (isBuffer) {
        this.highStart = data.readUInt32LE(0);
        this.errorValue = data.readUInt32LE(4);
        uncompressedLength = data.readUInt32LE(8);
        data = data.slice(12);
      } else {
        const view = new DataView(data.buffer);
        this.highStart = view.getUint32(0, true);
        this.errorValue = view.getUint32(4, true);
        uncompressedLength = view.getUint32(8, true);
        data = data.subarray(12);
      }

      // double inflate the actual trie data
      data = inflate(data, new Uint8Array(uncompressedLength));
      data = inflate(data, new Uint8Array(uncompressedLength));

      // swap bytes from little-endian
      swap32LE(data);

      this.data = new Uint32Array(data.buffer);

    } else {
      // pre-parsed data
      ({ data: this.data, highStart: this.highStart, errorValue: this.errorValue } = data);
    }
  }

  get(codePoint) {
    let index;
    if ((codePoint < 0) || (codePoint > 0x10ffff)) {
      return this.errorValue;
    }

    if ((codePoint < 0xd800) || ((codePoint > 0xdbff) && (codePoint <= 0xffff))) {
      // Ordinary BMP code point, excluding leading surrogates.
      // BMP uses a single level lookup.  BMP index starts at offset 0 in the index.
      // data is stored in the index array itself.
      index = (this.data[codePoint >> SHIFT_2] << INDEX_SHIFT) + (codePoint & DATA_MASK);
      return this.data[index];
    }

    if (codePoint <= 0xffff) {
      // Lead Surrogate Code Point.  A Separate index section is stored for
      // lead surrogate code units and code points.
      //   The main index has the code unit data.
      //   For this function, we need the code point data.
      index = (this.data[LSCP_INDEX_2_OFFSET + ((codePoint - 0xd800) >> SHIFT_2)] << INDEX_SHIFT) + (codePoint & DATA_MASK);
      return this.data[index];
    }

    if (codePoint < this.highStart) {
      // Supplemental code point, use two-level lookup.
      index = this.data[(INDEX_1_OFFSET - OMITTED_BMP_INDEX_1_LENGTH) + (codePoint >> SHIFT_1)];
      index = this.data[index + ((codePoint >> SHIFT_2) & INDEX_2_MASK)];
      index = (index << INDEX_SHIFT) + (codePoint & DATA_MASK);
      return this.data[index];
    }

    return this.data[this.data.length - DATA_GRANULARITY];
  }
}

module.exports = UnicodeTrie;
},{"./swap":13,"tiny-inflate":11}],13:[function(require,module,exports){
const isBigEndian = (new Uint8Array(new Uint32Array([0x12345678]).buffer)[0] === 0x12);

const swap = (b, n, m) => {
  let i = b[n];
  b[n] = b[m];
  b[m] = i;
};

const swap32 = array => {
  const len = array.length;
  for (let i = 0; i < len; i += 4) {
    swap(array, i, i + 3);
    swap(array, i + 1, i + 2);
  }
};

const swap32LE = array => {
  if (isBigEndian) {
    swap32(array);
  }
};

module.exports = {
  swap32LE: swap32LE
};

},{}],14:[function(require,module,exports){
// Entry point for browserifying fast-fuzzy
// This creates a standalone bundle that exposes fast-fuzzy as a global variable

const { fuzzy, search, Searcher } = require('fast-fuzzy');

// Export for browserify UMD wrapper
module.exports = {
    fuzzy: fuzzy,
    search: search,
    Searcher: Searcher
};

},{"fast-fuzzy":3}]},{},[14])(14)
});

// namespace
var cf;
(function (cf) {
    // interface
    // class
    var Helpers = /** @class */ (function () {
        function Helpers() {
        }
        Helpers.lerp = function (norm, min, max) {
            return (max - min) * norm + min;
        };
        Helpers.norm = function (value, min, max) {
            return (value - min) / (max - min);
        };
        Helpers.getXYFromMouseTouchEvent = function (event) {
            var touches = null;
            if (event.originalEvent)
                touches = event.originalEvent.touches || event.originalEvent.changedTouches;
            else if (event.changedTouches)
                touches = event.changedTouches;
            if (touches) {
                return { x: touches[0].pageX, y: touches[0].pageY, touches: touches[0] };
            }
            else {
                return { x: event.pageX, y: event.pageY, touches: null };
            }
        };
        Helpers.getInnerTextOfElement = function (element) {
            var tmp = document.createElement("DIV");
            tmp.innerHTML = element.innerHTML;
            // return 
            var text = tmp.textContent || tmp.innerText || "";
            // text = String(text).replace('\t','');
            text = String(text).replace(/^\s+|\s+$/g, '');
            return text;
        };
        Helpers.getMouseEvent = function (eventString) {
            var mappings = [];
            mappings["click"] = "ontouchstart" in window ? "touchstart" : "click";
            mappings["mousedown"] = "ontouchstart" in window ? "touchstart" : "mousedown";
            mappings["mouseup"] = "ontouchstart" in window ? "touchend" : "mouseup";
            mappings["mousemove"] = "ontouchstart" in window ? "touchmove" : "mousemove";
            return mappings[eventString];
        };
        Helpers.isInternetExlorer = function () {
            var ua = window.navigator.userAgent;
            var msie = ua.indexOf("MSIE ");
            return msie > 0 || !!navigator.userAgent.match(/Trident.*rv\:11\./);
        };
        Helpers.getValuesOfBars = function (str) {
            var strs = str.split("||");
            // TODO: remove single |
            // fallback to the standard
            if (strs.length <= 1)
                strs = str.split("|");
            return strs;
        };
        Helpers.setTransform = function (el, transformString) {
            el.style["-webkit-transform"] = transformString;
            el.style["-moz-transform"] = transformString;
            el.style["-ms-transform"] = transformString;
            el.style["transform"] = transformString;
        };
        // deep extends and object, from: https://andrewdupont.net/2009/08/28/deep-extending-objects-in-javascript/
        Helpers.extendObject = function (destination, source) {
            for (var property in source) {
                if (source[property] && source[property].constructor &&
                    source[property].constructor === Object) {
                    destination[property] = destination[property] || {};
                    arguments.callee(destination[property], source[property]);
                }
                else {
                    destination[property] = source[property];
                }
            }
            return destination;
        };
        ;
        Helpers.caniuse = {
            fileReader: function () {
                if (window.File && window.FileReader && window.FileList && window.Blob)
                    return true;
                return false;
            }
        };
        return Helpers;
    }());
    cf.Helpers = Helpers;
})(cf || (cf = {}));

/// <reference path="../ConversationalForm.ts"/>
var cf;
(function (cf) {
    // interface
    var EventDispatcher = /** @class */ (function () {
        function EventDispatcher(cfRef) {
            if (cfRef === void 0) { cfRef = null; }
            this._cf = cfRef;
            this.target = document.createDocumentFragment();
        }
        Object.defineProperty(EventDispatcher.prototype, "cf", {
            get: function () {
                return this._cf;
            },
            set: function (value) {
                this._cf = value;
            },
            enumerable: true,
            configurable: true
        });
        EventDispatcher.prototype.addEventListener = function (type, listener, useCapture) {
            return this.target.addEventListener(type, listener, useCapture);
        };
        EventDispatcher.prototype.dispatchEvent = function (event) {
            return this.target.dispatchEvent(event);
        };
        EventDispatcher.prototype.removeEventListener = function (type, listener, useCapture) {
            this.target.removeEventListener(type, listener, useCapture);
        };
        return EventDispatcher;
    }());
    cf.EventDispatcher = EventDispatcher;
})(cf || (cf = {}));

// namespace
var cf;
(function (cf) {
    // interface
    var TagsParser = /** @class */ (function () {
        function TagsParser() {
        }
        TagsParser.parseTag = function (element) {
            var tag = document.createElement(element.tag);
            tag.setAttribute("cf-formless", "");
            // TODO: ES6 mapping??
            for (var k in element) {
                if (k !== "tag" && k !== "children") {
                    tag.setAttribute(k, element[k]);
                }
            }
            return tag;
        };
        TagsParser.parseGroupTag = function (groupTag) {
            var groupEl = TagsParser.parseTag(groupTag);
            var groupChildren = groupTag.children;
            for (var j = 0; j < groupChildren.length; j++) {
                var fieldSetTagData = groupChildren[j];
                var tag = TagsParser.parseTag(fieldSetTagData);
                groupEl.appendChild(tag);
            }
            return groupEl;
        };
        TagsParser.parseJSONIntoElements = function (data) {
            var formEl = document.createElement("form");
            for (var i = 0; i < data.length; i++) {
                var element = data[i];
                var tag = TagsParser.parseTag(element);
                // add sub children to tag, ex. option, checkbox, etc.
                if (element.children && element.children.length > 0) {
                    for (var j = 0; j < element.children.length; j++) {
                        var subElement = TagsParser.parseTag(element.children[j]);
                        tag.appendChild(subElement);
                    }
                }
                formEl.appendChild(tag);
            }
            return formEl;
        };
        TagsParser.isElementFormless = function (element) {
            if (element.hasAttribute("cf-formless"))
                return true;
            return false;
        };
        return TagsParser;
    }());
    cf.TagsParser = TagsParser;
})(cf || (cf = {}));

// namespace
var cf;
(function (cf) {
    // default options interface for optional parameters for the UI of Conversational Form
    cf.UserInterfaceDefaultOptions = {
        controlElementsInAnimationDelay: 250,
        robot: {
            robotResponseTime: 0,
            chainedResponseTime: 500
        },
        user: {
            showThinking: false,
            showThumb: false
        }
    };
})(cf || (cf = {}));

/// <reference path="../logic/EventDispatcher.ts"/>
// namespace
var cf;
(function (cf) {
    // class
    var BasicElement = /** @class */ (function () {
        function BasicElement(options) {
            this.eventTarget = options.eventTarget;
            this.cfReference = options.cfReference;
            if (options.customTemplate)
                this.customTemplate = options.customTemplate;
            // TODO: remove
            if (!this.eventTarget)
                throw new Error("this.eventTarget not set!! : " + this.constructor.name);
            this.setData(options);
            this.createElement();
            this.onElementCreated();
        }
        BasicElement.prototype.setData = function (options) {
        };
        BasicElement.prototype.onElementCreated = function () {
        };
        BasicElement.prototype.createElement = function () {
            var template = document.createElement('template');
            template.innerHTML = this.getTemplate();
            this.el = template.firstChild || template.content.firstChild;
            return this.el;
        };
        // template, should be overwritten ...
        BasicElement.prototype.getTemplate = function () { return this.customTemplate || "should be overwritten..."; };
        ;
        BasicElement.prototype.dealloc = function () {
            this.el.parentNode.removeChild(this.el);
        };
        return BasicElement;
    }());
    cf.BasicElement = BasicElement;
})(cf || (cf = {}));

/// <reference path="../../ConversationalForm.ts"/>
/// <reference path="../BasicElement.ts"/>
/// <reference path="../../form-tags/Tag.ts"/>
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
// namespace
var cf;
(function (cf) {
    cf.ControlElementEvents = {
        SUBMIT_VALUE: "cf-basic-element-submit",
        PROGRESS_CHANGE: "cf-basic-element-progress",
        ON_FOCUS: "cf-basic-element-on-focus",
        ON_LOADED: "cf-basic-element-on-loaded",
    };
    cf.ControlElementProgressStates = {
        BUSY: "cf-control-element-progress-BUSY",
        READY: "cf-control-element-progress-READY",
    };
    // class
    var ControlElement = /** @class */ (function (_super) {
        __extends(ControlElement, _super);
        function ControlElement(options) {
            var _this = _super.call(this, options) || this;
            _this.animateInTimer = 0;
            _this._partOfSeveralChoices = false;
            _this._focus = false;
            _this.onFocusCallback = _this.onFocus.bind(_this);
            _this.el.addEventListener('focus', _this.onFocusCallback, false);
            _this.onBlurCallback = _this.onBlur.bind(_this);
            _this.el.addEventListener('blur', _this.onBlurCallback, false);
            if (_this.referenceTag.disabled) {
                _this.el.setAttribute("disabled", "disabled");
            }
            return _this;
        }
        Object.defineProperty(ControlElement.prototype, "type", {
            get: function () {
                return "ControlElement";
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ControlElement.prototype, "partOfSeveralChoices", {
            get: function () {
                return this._partOfSeveralChoices;
            },
            set: function (value) {
                this._partOfSeveralChoices = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ControlElement.prototype, "value", {
            get: function () {
                // value is for the chat response -->
                var hasTagImage = this.referenceTag.hasImage;
                var str;
                if (hasTagImage && !this.partOfSeveralChoices) {
                    // const image: string = hasTagImage ? "<img src='" + this.referenceTag.domElement.getAttribute("cf-image") + "'/>" : "";
                    var image = hasTagImage ? "<img src=\"" + this.referenceTag.domElement.getAttribute("cf-image") + "\"/>" : "";
                    // str = "<div class='contains-image'>"
                    // str += image;
                    // str += "<span>" + Helpers.getInnerTextOfElement(this.el) + "</span>";
                    // str += "</div>";
                    str = image + cf.Helpers.getInnerTextOfElement(this.el);
                }
                else {
                    // str = "<div><span>" + Helpers.getInnerTextOfElement(this.el) + "</span></div>";
                    str = cf.Helpers.getInnerTextOfElement(this.el);
                }
                return str;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ControlElement.prototype, "positionVector", {
            get: function () {
                return this._positionVector;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ControlElement.prototype, "tabIndex", {
            set: function (value) {
                this.el.tabIndex = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ControlElement.prototype, "highlight", {
            get: function () {
                return this.el.classList.contains("highlight");
            },
            set: function (value) {
                if (value)
                    this.el.classList.add("highlight");
                else
                    this.el.classList.remove("highlight");
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ControlElement.prototype, "focus", {
            get: function () {
                return this._focus;
            },
            set: function (value) {
                this._focus = value;
                if (this._focus)
                    this.el.focus();
                else
                    this.el.blur();
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ControlElement.prototype, "visible", {
            get: function () {
                return !this.el.classList.contains("hide");
            },
            set: function (value) {
                if (value) {
                    this.el.classList.remove("hide");
                }
                else {
                    this.el.classList.add("hide");
                    this.tabIndex = -1;
                    this.highlight = false;
                }
            },
            enumerable: true,
            configurable: true
        });
        ControlElement.prototype.onBlur = function (event) {
            this._focus = false;
        };
        ControlElement.prototype.onFocus = function (event) {
            this._focus = true;
            cf.ConversationalForm.illustrateFlow(this, "dispatch", cf.ControlElementEvents.ON_FOCUS, this.referenceTag);
            this.eventTarget.dispatchEvent(new CustomEvent(cf.ControlElementEvents.ON_FOCUS, {
                detail: this.positionVector
            }));
        };
        /**
        * @name hasImage
        * if control element contains an image element
        */
        ControlElement.prototype.hasImage = function () {
            return false;
        };
        ControlElement.prototype.calcPosition = function () {
            var mr = parseInt(window.getComputedStyle(this.el).getPropertyValue("margin-right"), 10);
            // try not to do this to often, re-paint whammy!
            this._positionVector = {
                height: this.el.offsetHeight,
                width: this.el.offsetWidth + mr,
                x: this.el.offsetLeft,
                y: this.el.offsetTop,
                el: this,
            };
            this._positionVector.centerX = this._positionVector.x + (this._positionVector.width * 0.5);
            this._positionVector.centerY = this._positionVector.y + (this._positionVector.height * 0.5);
        };
        ControlElement.prototype.setData = function (options) {
            this.referenceTag = options.referenceTag;
            _super.prototype.setData.call(this, options);
        };
        ControlElement.prototype.animateIn = function () {
            clearTimeout(this.animateInTimer);
            this.el.classList.add("animate-in");
        };
        ControlElement.prototype.animateOut = function () {
            this.el.classList.add("animate-out");
        };
        ControlElement.prototype.onChoose = function () {
            cf.ConversationalForm.illustrateFlow(this, "dispatch", cf.ControlElementEvents.SUBMIT_VALUE, this.referenceTag);
            this.eventTarget.dispatchEvent(new CustomEvent(cf.ControlElementEvents.SUBMIT_VALUE, {
                detail: this
            }));
        };
        ControlElement.prototype.dealloc = function () {
            this.el.removeEventListener('blur', this.onBlurCallback, false);
            this.onBlurCallback = null;
            this.el.removeEventListener('focus', this.onFocusCallback, false);
            this.onFocusCallback = null;
            _super.prototype.dealloc.call(this);
        };
        return ControlElement;
    }(cf.BasicElement));
    cf.ControlElement = ControlElement;
})(cf || (cf = {}));

/// <reference path="Button.ts"/>
/// <reference path="ControlElement.ts"/>
/// <reference path="RadioButton.ts"/>
/// <reference path="CheckboxButton.ts"/>
/// <reference path="OptionsList.ts"/>
/// <reference path="UploadFileUI.ts"/>
/// <reference path="../../logic/EventDispatcher.ts"/>
/// <reference path="../ScrollController.ts"/>
/// <reference path="../chat/ChatResponse.ts"/>
/// <reference path="../../../typings/globals/es6-promise/index.d.ts"/>
// namespace
var cf;
(function (cf) {
    cf.ControlElementsEvents = {
        ON_RESIZE: "cf-on-control-elements-resize",
        CHANGED: "cf-on-control-elements-changed"
    };
    var ControlElements = /** @class */ (function () {
        function ControlElements(options) {
            this.ignoreKeyboardInput = false;
            this.rowIndex = -1;
            this.columnIndex = 0;
            this.elementWidth = 0;
            this.filterListNumberOfVisible = 0;
            this.listWidth = 0;
            this.el = options.el;
            this.eventTarget = options.eventTarget;
            this.cfReference = options.cfReference;
            this.list = this.el.getElementsByTagName("cf-list")[0];
            this.infoElement = options.infoEl;
            this.onScrollCallback = this.onScroll.bind(this);
            this.el.addEventListener('scroll', this.onScrollCallback, false);
            this.onResizeCallback = this.onResize.bind(this);
            window.addEventListener('resize', this.onResizeCallback, false);
            this.onElementFocusCallback = this.onElementFocus.bind(this);
            this.eventTarget.addEventListener(cf.ControlElementEvents.ON_FOCUS, this.onElementFocusCallback, false);
            this.onElementLoadedCallback = this.onElementLoaded.bind(this);
            this.eventTarget.addEventListener(cf.ControlElementEvents.ON_LOADED, this.onElementLoadedCallback, false);
            this.onChatReponsesUpdatedCallback = this.onChatReponsesUpdated.bind(this);
            this.eventTarget.addEventListener(cf.ChatListEvents.CHATLIST_UPDATED, this.onChatReponsesUpdatedCallback, false);
            this.onUserInputKeyChangeCallback = this.onUserInputKeyChange.bind(this);
            this.eventTarget.addEventListener(cf.UserInputEvents.KEY_CHANGE, this.onUserInputKeyChangeCallback, false);
            // user input update
            this.userInputUpdateCallback = this.onUserInputUpdate.bind(this);
            this.eventTarget.addEventListener(cf.FlowEvents.USER_INPUT_UPDATE, this.userInputUpdateCallback, false);
            this.listScrollController = new cf.ScrollController({
                interactionListener: this.el,
                listToScroll: this.list,
                eventTarget: this.eventTarget,
                listNavButtons: this.el.getElementsByTagName("cf-list-button"),
            });
        }
        Object.defineProperty(ControlElements.prototype, "active", {
            get: function () {
                return this.elements && this.elements.length > 0;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(ControlElements.prototype, "focus", {
            get: function () {
                if (!this.elements)
                    return false;
                var elements = this.getElements();
                for (var i = 0; i < elements.length; i++) {
                    var element = elements[i];
                    if (element.focus) {
                        return true;
                    }
                }
                return false;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(ControlElements.prototype, "highlighted", {
            get: function () {
                if (!this.elements)
                    return false;
                var elements = this.getElements();
                for (var i = 0; i < elements.length; i++) {
                    var element = elements[i];
                    if (element.highlight) {
                        return true;
                    }
                }
                return false;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(ControlElements.prototype, "disabled", {
            set: function (value) {
                if (value)
                    this.list.classList.add("disabled");
                else
                    this.list.classList.remove("disabled");
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(ControlElements.prototype, "length", {
            get: function () {
                var elements = this.getElements();
                return elements.length;
            },
            enumerable: false,
            configurable: true
        });
        ControlElements.prototype.onScroll = function (event) {
            // some times the tabbing will result in el scroll, reset this.
            this.el.scrollLeft = 0;
        };
        /**
        * @name onElementLoaded
        * when element is loaded, usally image loaded.
        */
        ControlElements.prototype.onElementLoaded = function (event) {
            this.onResize(null);
        };
        ControlElements.prototype.onElementFocus = function (event) {
            var vector = event.detail;
            var x = (vector.x + vector.width < this.elementWidth ? 0 : vector.x - vector.width);
            x *= -1;
            this.updateRowColIndexFromVector(vector);
            this.listScrollController.setScroll(x, 0);
        };
        ControlElements.prototype.updateRowColIndexFromVector = function (vector) {
            for (var i = 0; i < this.tableableRows.length; i++) {
                var items = this.tableableRows[i];
                for (var j = 0; j < items.length; j++) {
                    var item = items[j];
                    if (item == vector.el) {
                        this.rowIndex = i;
                        this.columnIndex = j;
                        break;
                    }
                }
            }
        };
        ControlElements.prototype.onChatReponsesUpdated = function (event) {
            var _this = this;
            clearTimeout(this.animateInFromResponseTimer);
            // only show when user response
            if (!event.detail.currentResponse.isRobotResponse) {
                this.animateInFromResponseTimer = setTimeout(function () {
                    _this.animateElementsIn();
                }, this.cfReference.uiOptions.controlElementsInAnimationDelay);
            }
        };
        ControlElements.prototype.onListChanged = function () {
            var _this = this;
            // reflow
            this.list.offsetHeight;
            requestAnimationFrame(function () {
                cf.ConversationalForm.illustrateFlow(_this, "dispatch", cf.ControlElementsEvents.CHANGED);
                _this.eventTarget.dispatchEvent(new CustomEvent(cf.ControlElementsEvents.CHANGED));
            });
        };
        ControlElements.prototype.onUserInputKeyChange = function (event) {
            if (this.ignoreKeyboardInput) {
                this.ignoreKeyboardInput = false;
                return;
            }
            var dto = event.detail;
            var userInput = dto.dto.input;
            if (this.active) {
                var isNavKey = [cf.Dictionary.keyCodes["left"], cf.Dictionary.keyCodes["right"], cf.Dictionary.keyCodes["down"], cf.Dictionary.keyCodes["up"]].indexOf(dto.keyCode) != -1;
                var shouldFilter = dto.inputFieldActive && !isNavKey;
                if (shouldFilter) {
                    // input field is active, so we should filter..
                    var dto_1 = event.detail.dto;
                    var inputValue = dto_1.input.getInputValue();
                    this.filterElementsFrom(inputValue);
                }
                else {
                    if (dto.keyCode == cf.Dictionary.keyCodes["left"]) {
                        this.columnIndex--;
                    }
                    else if (dto.keyCode == cf.Dictionary.keyCodes["right"]) {
                        this.columnIndex++;
                    }
                    else if (dto.keyCode == cf.Dictionary.keyCodes["down"]) {
                        this.updateRowIndex(1);
                    }
                    else if (dto.keyCode == cf.Dictionary.keyCodes["up"]) {
                        this.updateRowIndex(-1);
                    }
                    else if (dto.keyCode == cf.Dictionary.keyCodes["enter"] || dto.keyCode == cf.Dictionary.keyCodes["space"]) {
                        if (this.tableableRows[this.rowIndex] && this.tableableRows[this.rowIndex][this.columnIndex]) {
                            this.tableableRows[this.rowIndex][this.columnIndex].el.click();
                        }
                        else if (this.tableableRows[0] && this.tableableRows[0].length == 1) {
                            // this is when only one element in a filter, then we click it!
                            this.tableableRows[0][0].el.click();
                        }
                    }
                    if (!this.validateRowColIndexes()) {
                        userInput.setFocusOnInput();
                    }
                }
            }
            if (!userInput.active && this.validateRowColIndexes() && this.tableableRows && (this.rowIndex == 0 || this.rowIndex == 1)) {
                this.tableableRows[this.rowIndex][this.columnIndex].focus = true;
            }
            else if (!userInput.active) {
                userInput.setFocusOnInput();
            }
        };
        ControlElements.prototype.validateRowColIndexes = function () {
            var maxRowIndex = (this.el.classList.contains("two-row") ? 1 : 0);
            if (this.rowIndex != -1 && this.tableableRows[this.rowIndex]) {
                // columnIndex is only valid if rowIndex is valid
                if (this.columnIndex < 0) {
                    this.columnIndex = this.tableableRows[this.rowIndex].length - 1;
                }
                if (this.columnIndex > this.tableableRows[this.rowIndex].length - 1) {
                    this.columnIndex = 0;
                }
                return true;
            }
            else {
                this.resetTabList();
                return false;
            }
        };
        ControlElements.prototype.updateRowIndex = function (direction) {
            var oldRowIndex = this.rowIndex;
            this.rowIndex += direction;
            if (this.tableableRows[this.rowIndex]) {
                // when row index is changed we need to find the closest column element, we cannot expect them to be indexly aligned
                var centerX = this.tableableRows[oldRowIndex] ? this.tableableRows[oldRowIndex][this.columnIndex].positionVector.centerX : 0;
                var items = this.tableableRows[this.rowIndex];
                var currentDistance = 10000000000000;
                for (var i = 0; i < items.length; i++) {
                    var element = items[i];
                    if (currentDistance > Math.abs(centerX - element.positionVector.centerX)) {
                        currentDistance = Math.abs(centerX - element.positionVector.centerX);
                        this.columnIndex = i;
                    }
                }
            }
        };
        ControlElements.prototype.resetTabList = function () {
            this.rowIndex = -1;
            this.columnIndex = -1;
        };
        ControlElements.prototype.onUserInputUpdate = function (event) {
            this.el.classList.remove("animate-in");
            this.infoElement.classList.remove("show");
            if (this.elements) {
                var elements = this.getElements();
                for (var i = 0; i < elements.length; i++) {
                    var element = elements[i];
                    element.animateOut();
                }
            }
        };
        ControlElements.prototype.getWeightedScore = function (input, target, threshold) {
            var inputLower = input.toLowerCase().trim();
            var targetLower = target.toLowerCase().trim();
            if (!inputLower || !targetLower)
                return 0;
            // Exact match - highest priority
            if (inputLower === targetLower)
                return 1.0;
            // Starts with (prefix match) - very high score
            if (targetLower.startsWith(inputLower))
                return 0.95;
            // Ends with (suffix match) - high score
            if (targetLower.endsWith(inputLower))
                return 0.90;
            // Fuzzy match using fast-fuzzy
            return FastFuzzy.fuzzy(inputLower, targetLower, { threshold: threshold });
        };
        ControlElements.prototype.filterElementsFrom = function (value) {
            var inputValuesLowerCase = value.toLowerCase().split(" ");
            if (inputValuesLowerCase.indexOf("") != -1)
                inputValuesLowerCase.splice(inputValuesLowerCase.indexOf(""), 1);
            var elements = this.getElements();
            if (elements.length > 1) {
                // the type is not strong with this one..
                var itemsVisible = [];
                for (var i = 0; i < elements.length; i++) {
                    var element = elements[i];
                    element.highlight = false;
                    var elementVisibility = true;
                    var maxScore = 0;
                    // check for all words of input with fuzzy matching
                    for (var i_1 = 0; i_1 < inputValuesLowerCase.length; i_1++) {
                        var inputWord = inputValuesLowerCase[i_1];
                        if (elementVisibility) {
                            // Check both cf-label and option value with weighted scoring
                            var labelText = element.value;
                            var optionValue = element.referenceTag ? element.referenceTag.value.toString() : '';
                            var threshold = 0.6;
                            // Use weighted scoring on both label and value
                            var labelScore = this.getWeightedScore(inputWord, labelText, threshold);
                            var valueScore = this.getWeightedScore(inputWord, optionValue, threshold);
                            var score = Math.max(labelScore, valueScore);
                            maxScore = Math.max(maxScore, score);
                            elementVisibility = score >= threshold;
                        }
                    }
                    // set element visibility and store the score
                    element.visible = elementVisibility;
                    if (elementVisibility && element.visible) {
                        element.matchScore = maxScore;
                        itemsVisible.push(element);
                    }
                }
                // Sort itemsVisible by score (descending) before highlighting
                itemsVisible.sort(function (a, b) { return (b.matchScore || 0) - (a.matchScore || 0); });
                // set feedback text for filter..
                this.infoElement.innerHTML = itemsVisible.length == 0 ? cf.Dictionary.get("input-no-filter").split("{input-value}").join(value) : "";
                if (itemsVisible.length == 0) {
                    this.infoElement.classList.add("show");
                }
                else {
                    this.infoElement.classList.remove("show");
                }
                // crude way of checking if list has changed...
                var hasListChanged = this.filterListNumberOfVisible != itemsVisible.length;
                if (hasListChanged) {
                    this.animateElementsIn();
                }
                this.filterListNumberOfVisible = itemsVisible.length;
                // highlight first item
                if (value != "" && this.filterListNumberOfVisible > 0)
                    itemsVisible[0].highlight = true;
            }
        };
        ControlElements.prototype.clickOnHighlighted = function () {
            var elements = this.getElements();
            for (var i = 0; i < elements.length; i++) {
                var element = elements[i];
                if (element.highlight) {
                    element.el.click();
                    break;
                }
            }
        };
        ControlElements.prototype.animateElementsIn = function () {
            var _this = this;
            if (this.elements.length > 0) {
                this.resize();
                // this.el.style.transition = 'height 0.35s ease-out 0.2s';
                this.list.style.height = '0px';
                setTimeout(function () {
                    _this.list.style.height = _this.list.scrollHeight + 'px';
                    var elements = _this.getElements();
                    setTimeout(function () {
                        if (elements.length > 0) {
                            if (!_this.el.classList.contains("animate-in"))
                                _this.el.classList.add("animate-in");
                            for (var i = 0; i < elements.length; i++) {
                                var element = elements[i];
                                element.animateIn();
                            }
                        }
                        document.querySelector('.scrollableInner').classList.remove('scroll');
                        // Check if chatlist is scrolled to the bottom - if not we need to do it manually (pertains to Chrome)
                        var scrollContainer = document.querySelector('scrollable');
                        if (scrollContainer.scrollTop < scrollContainer.scrollHeight) {
                            scrollContainer.scrollTop = scrollContainer.scrollHeight;
                        }
                    }, 300);
                }, 200);
            }
        };
        ControlElements.prototype.getElements = function () {
            if (this.elements && this.elements.length > 0 && this.elements[0].type == "OptionsList")
                return this.elements[0].elements;
            return this.elements;
        };
        /**
        * @name buildTabableRows
        * build the tabable array index
        */
        ControlElements.prototype.buildTabableRows = function () {
            this.tableableRows = [];
            this.resetTabList();
            var elements = this.getElements();
            if (this.el.classList.contains("two-row")) {
                // two rows
                this.tableableRows[0] = [];
                this.tableableRows[1] = [];
                for (var i = 0; i < elements.length; i++) {
                    var element = elements[i];
                    if (element.visible) {
                        // crude way of checking if element is top row or bottom row..
                        if (element.positionVector.y < 30)
                            this.tableableRows[0].push(element);
                        else
                            this.tableableRows[1].push(element);
                    }
                }
            }
            else {
                // single row
                this.tableableRows[0] = [];
                for (var i = 0; i < elements.length; i++) {
                    var element = elements[i];
                    if (element.visible)
                        this.tableableRows[0].push(element);
                }
            }
        };
        ControlElements.prototype.resetAfterErrorMessage = function () {
            this.currentControlElement = null;
            this.disabled = false;
        };
        ControlElements.prototype.focusFrom = function (angle) {
            if (!this.tableableRows)
                return;
            this.columnIndex = 0;
            if (angle == "bottom") {
                this.rowIndex = this.el.classList.contains("two-row") ? 1 : 0;
            }
            else if (angle == "top") {
                this.rowIndex = 0;
            }
            if (this.tableableRows[this.rowIndex] && this.tableableRows[this.rowIndex][this.columnIndex]) {
                this.ignoreKeyboardInput = true;
                if (!this.cfReference.options.preventAutoFocus) {
                    this.tableableRows[this.rowIndex][this.columnIndex].focus = true;
                }
            }
            else {
                this.resetTabList();
            }
        };
        ControlElements.prototype.updateStateOnElementsFromTag = function (tag) {
            for (var index = 0; index < this.elements.length; index++) {
                var element = this.elements[index];
                if (element.referenceTag == tag) {
                    this.updateStateOnElements(element);
                    break;
                }
            }
        };
        ControlElements.prototype.updateStateOnElements = function (controlElement) {
            this.currentControlElement = controlElement;
            if (this.currentControlElement.type == "RadioButton") {
                // uncheck other radio buttons...
                var elements = this.getElements();
                for (var i = 0; i < elements.length; i++) {
                    var element = elements[i];
                    if (element != controlElement) {
                        element.checked = false;
                    }
                    else {
                        element.checked = true;
                    }
                }
            }
            else if (this.currentControlElement.type == "CheckboxButton") {
                // change only the changed input
                var elements = this.getElements();
                for (var i = 0; i < elements.length; i++) {
                    var element = elements[i];
                    if (element == controlElement) {
                        var isChecked = element.referenceTag.domElement.checked;
                        element.checked = isChecked;
                    }
                }
            }
        };
        ControlElements.prototype.reset = function () {
            this.infoElement.classList.remove("show");
            this.el.classList.remove("one-row");
            this.el.classList.remove("two-row");
            // this.el.style.transition = 'height 0.35s ease-out 0.2s';
            this.list.style.height = '0px';
        };
        ControlElements.prototype.getElement = function (index) {
            return this.elements[index];
        };
        ControlElements.prototype.getDTO = function () {
            var dto = {
                text: undefined,
                controlElements: [],
            };
            // generate text value for ChatReponse
            if (this.elements && this.elements.length > 0) {
                switch (this.elements[0].type) {
                    case "CheckboxButton":
                        var numChecked = 0; // check if more than 1 is checked.
                        var values = [];
                        for (var i = 0; i < this.elements.length; i++) {
                            var element_1 = this.elements[i];
                            if (element_1.checked) {
                                if (numChecked++ > 1)
                                    break;
                            }
                        }
                        for (var i = 0; i < this.elements.length; i++) {
                            var element_2 = this.elements[i];
                            if (element_2.checked) {
                                if (numChecked > 1)
                                    element_2.partOfSeveralChoices = true;
                                values.push(element_2.value);
                            }
                            dto.controlElements.push(element_2);
                        }
                        dto.text = cf.Dictionary.parseAndGetMultiValueString(values);
                        break;
                    case "RadioButton":
                        for (var i = 0; i < this.elements.length; i++) {
                            var element_3 = this.elements[i];
                            if (element_3.checked) {
                                dto.text = element_3.value;
                            }
                            dto.controlElements.push(element_3);
                        }
                        break;
                    case "OptionsList":
                        var element = this.elements[0];
                        dto.controlElements = element.getValue();
                        var values = [];
                        if (dto.controlElements && dto.controlElements[0]) {
                            for (var i_2 = 0; i_2 < dto.controlElements.length; i_2++) {
                                var element_4 = dto.controlElements[i_2];
                                values.push(dto.controlElements[i_2].value);
                            }
                        }
                        // after value is created then set to all elements
                        dto.controlElements = element.elements;
                        dto.text = cf.Dictionary.parseAndGetMultiValueString(values);
                        break;
                    case "UploadFileUI":
                        dto.text = this.elements[0].getFilesAsString(); //Dictionary.parseAndGetMultiValueString(values);
                        dto.controlElements.push(this.elements[0]);
                        break;
                }
            }
            return dto;
        };
        ControlElements.prototype.clearTagsAndReset = function () {
            this.reset();
            if (this.elements) {
                while (this.elements.length > 0) {
                    this.elements.pop().dealloc();
                }
            }
            this.list.innerHTML = "";
            this.onListChanged();
        };
        ControlElements.prototype.buildTags = function (tags) {
            var _this = this;
            this.disabled = false;
            var topList = this.el.parentNode.getElementsByTagName("ul")[0];
            var bottomList = this.el.parentNode.getElementsByTagName("ul")[1];
            // remove old elements
            this.clearTagsAndReset();
            this.elements = [];
            for (var i = 0; i < tags.length; i++) {
                var tag = tags[i];
                switch (tag.type) {
                    case "radio":
                        this.elements.push(new cf.RadioButton({
                            referenceTag: tag,
                            eventTarget: this.eventTarget
                        }));
                        break;
                    case "checkbox":
                        this.elements.push(new cf.CheckboxButton({
                            referenceTag: tag,
                            eventTarget: this.eventTarget
                        }));
                        break;
                    case "select":
                        this.elements.push(new cf.OptionsList({
                            referenceTag: tag,
                            context: this.list,
                            eventTarget: this.eventTarget
                        }));
                        break;
                    case "input":
                    default:
                        if (tag.type == "file") {
                            this.elements.push(new cf.UploadFileUI({
                                referenceTag: tag,
                                eventTarget: this.eventTarget
                            }));
                        }
                        // nothing to add.
                        break;
                }
                if (tag.type != "select" && this.elements.length > 0) {
                    var element = this.elements[this.elements.length - 1];
                    this.list.appendChild(element.el);
                }
            }
            var isElementsOptionsList = this.elements[0] && this.elements[0].type == "OptionsList";
            if (isElementsOptionsList) {
                this.filterListNumberOfVisible = this.elements[0].elements.length;
            }
            else {
                this.filterListNumberOfVisible = tags.length;
            }
            new Promise(function (resolve, reject) { return _this.resize(resolve, reject); }).then(function () {
                var h = _this.list.offsetHeight; //this.el.classList.contains("one-row") ? 52 : this.el.classList.contains("two-row") ? 102 : 0;
                var controlElementsAddedDTO = {
                    height: h,
                };
                _this.onListChanged();
                cf.ConversationalForm.illustrateFlow(_this, "dispatch", cf.UserInputEvents.CONTROL_ELEMENTS_ADDED, controlElementsAddedDTO);
                _this.eventTarget.dispatchEvent(new CustomEvent(cf.UserInputEvents.CONTROL_ELEMENTS_ADDED, {
                    detail: controlElementsAddedDTO
                }));
            });
        };
        ControlElements.prototype.onResize = function (event) {
            this.resize();
        };
        ControlElements.prototype.resize = function (resolve, reject) {
            // scrollbar things
            // Element.offsetWidth - Element.clientWidth
            this.list.style.width = "100%";
            this.el.classList.remove("resized");
            this.el.classList.remove("one-row");
            this.el.classList.remove("two-row");
            this.elementWidth = 0;
            this.listWidth = 0;
            var elements = this.getElements();
            if (elements && elements.length > 0) {
                var listWidthValues = [];
                var listWidthValues2 = [];
                var containsElementWithImage = false;
                for (var i = 0; i < elements.length; i++) {
                    var element = elements[i];
                    if (element.visible) {
                        element.calcPosition();
                        this.listWidth += element.positionVector.width;
                        listWidthValues.push(element.positionVector.x + element.positionVector.width);
                        listWidthValues2.push(element);
                    }
                    if (element.hasImage())
                        containsElementWithImage = true;
                }
                var elOffsetWidth = this.el.offsetWidth;
                var isListWidthOverElementWidth = this.listWidth > elOffsetWidth;
                if (isListWidthOverElementWidth && !containsElementWithImage) {
                    this.el.classList.add("two-row");
                    this.listWidth = Math.max(elOffsetWidth, Math.round((listWidthValues[Math.floor(listWidthValues.length / 2)]) + 50));
                    this.list.style.width = this.listWidth + "px";
                }
                else {
                    this.el.classList.add("one-row");
                }
                // recalc after LIST classes has been added
                for (var i = 0; i < elements.length; i++) {
                    var element = elements[i];
                    if (element.visible) {
                        element.calcPosition();
                    }
                }
                // check again after classes are set.
                elOffsetWidth = this.el.offsetWidth;
                isListWidthOverElementWidth = this.listWidth > elOffsetWidth;
                // sort the list so we can set tabIndex properly
                var elementsCopyForSorting = elements.slice();
                var tabIndexFilteredElements = elementsCopyForSorting.sort(function (a, b) {
                    var aOverB = a.positionVector.y > b.positionVector.y;
                    return a.positionVector.x == b.positionVector.x ? (aOverB ? 1 : -1) : a.positionVector.x < b.positionVector.x ? -1 : 1;
                });
                var tabIndex = 0;
                for (var i = 0; i < tabIndexFilteredElements.length; i++) {
                    var element = tabIndexFilteredElements[i];
                    if (element.visible) {
                        //tabindex 1 are the UserTextInput element
                        element.tabIndex = 2 + (tabIndex++);
                    }
                    else {
                        element.tabIndex = -1;
                    }
                }
                // toggle nav button visiblity
                if (isListWidthOverElementWidth) {
                    this.el.classList.remove("hide-nav-buttons");
                }
                else {
                    this.el.classList.add("hide-nav-buttons");
                }
                this.elementWidth = elOffsetWidth;
                // resize scroll
                this.listScrollController.resize(this.listWidth, this.elementWidth);
                this.el.classList.add("resized");
                this.eventTarget.dispatchEvent(new CustomEvent(cf.ControlElementsEvents.ON_RESIZE));
                if (resolve) {
                    // only build when there is something to resolve
                    this.buildTabableRows();
                    resolve();
                }
            }
        };
        ControlElements.prototype.dealloc = function () {
            this.currentControlElement = null;
            this.tableableRows = null;
            window.removeEventListener('resize', this.onResizeCallback, false);
            this.onResizeCallback = null;
            this.el.removeEventListener('scroll', this.onScrollCallback, false);
            this.onScrollCallback = null;
            this.eventTarget.removeEventListener(cf.ControlElementEvents.ON_FOCUS, this.onElementFocusCallback, false);
            this.onElementFocusCallback = null;
            this.eventTarget.removeEventListener(cf.ChatListEvents.CHATLIST_UPDATED, this.onChatReponsesUpdatedCallback, false);
            this.onChatReponsesUpdatedCallback = null;
            this.eventTarget.removeEventListener(cf.UserInputEvents.KEY_CHANGE, this.onUserInputKeyChangeCallback, false);
            this.onUserInputKeyChangeCallback = null;
            this.eventTarget.removeEventListener(cf.FlowEvents.USER_INPUT_UPDATE, this.userInputUpdateCallback, false);
            this.userInputUpdateCallback = null;
            this.eventTarget.removeEventListener(cf.ControlElementEvents.ON_LOADED, this.onElementLoadedCallback, false);
            this.onElementLoadedCallback = null;
            this.listScrollController.dealloc();
        };
        return ControlElements;
    }());
    cf.ControlElements = ControlElements;
})(cf || (cf = {}));

/// <reference path="../logic/Helpers.ts"/>
/// <reference path="../logic/EventDispatcher.ts"/>
// namespace
var cf;
(function (cf) {
    var ScrollController = /** @class */ (function () {
        function ScrollController(options) {
            this.listWidth = 0;
            this.visibleAreaWidth = 0;
            this.max = 0;
            this.interacting = false;
            this.x = 0;
            this.xTarget = 0;
            this.startX = 0;
            this.startXTarget = 0;
            this.mouseSpeed = 0;
            this.mouseSpeedTarget = 0;
            this.direction = 0;
            this.directionTarget = 0;
            this.inputAccerlation = 0;
            this.inputAccerlationTarget = 0;
            this.interactionListener = options.interactionListener;
            this.eventTarget = options.eventTarget;
            this.listToScroll = options.listToScroll;
            this.prevButton = options.listNavButtons[0];
            this.nextButton = options.listNavButtons[1];
            this.onListNavButtonsClickCallback = this.onListNavButtonsClick.bind(this);
            this.prevButton.addEventListener("click", this.onListNavButtonsClickCallback, false);
            this.nextButton.addEventListener("click", this.onListNavButtonsClickCallback, false);
            this.documentLeaveCallback = this.documentLeave.bind(this);
            this.onInteractStartCallback = this.onInteractStart.bind(this);
            this.onInteractEndCallback = this.onInteractEnd.bind(this);
            this.onInteractMoveCallback = this.onInteractMove.bind(this);
            document.addEventListener("mouseleave", this.documentLeaveCallback, false);
            document.addEventListener(cf.Helpers.getMouseEvent("mouseup"), this.documentLeaveCallback, false);
            this.interactionListener.addEventListener(cf.Helpers.getMouseEvent("mousedown"), this.onInteractStartCallback, false);
            this.interactionListener.addEventListener(cf.Helpers.getMouseEvent("mouseup"), this.onInteractEndCallback, false);
            this.interactionListener.addEventListener(cf.Helpers.getMouseEvent("mousemove"), this.onInteractMoveCallback, false);
        }
        ScrollController.prototype.onListNavButtonsClick = function (event) {
            var dirClick = event.currentTarget.getAttribute("direction");
            this.pushDirection(dirClick == "next" ? -1 : 1);
        };
        ScrollController.prototype.documentLeave = function (event) {
            this.onInteractEnd(event);
        };
        ScrollController.prototype.onInteractStart = function (event) {
            var vector = cf.Helpers.getXYFromMouseTouchEvent(event);
            this.interacting = true;
            this.startX = vector.x;
            this.startXTarget = this.startX;
            this.inputAccerlation = 0;
            this.render();
        };
        ScrollController.prototype.onInteractEnd = function (event) {
            this.interacting = false;
        };
        ScrollController.prototype.onInteractMove = function (event) {
            if (this.interacting) {
                var vector = cf.Helpers.getXYFromMouseTouchEvent(event);
                var newAcc = vector.x - this.startX;
                var magnifier = 6.2;
                this.inputAccerlationTarget = newAcc * magnifier;
                this.directionTarget = this.inputAccerlationTarget < 0 ? -1 : 1;
                this.startXTarget = vector.x;
            }
        };
        ScrollController.prototype.render = function () {
            var _this = this;
            if (this.rAF)
                cancelAnimationFrame(this.rAF);
            // normalise startX
            this.startX += (this.startXTarget - this.startX) * 0.2;
            // animate accerlaration
            this.inputAccerlation += (this.inputAccerlationTarget - this.inputAccerlation) * (this.interacting ? Math.min(ScrollController.acceleration + 0.1, 1) : ScrollController.acceleration);
            var accDamping = 0.25;
            this.inputAccerlationTarget *= accDamping;
            // animate directions
            this.direction += (this.directionTarget - this.direction) * 0.2;
            // extra extra
            this.mouseSpeed += (this.mouseSpeedTarget - this.mouseSpeed) * 0.2;
            this.direction += this.mouseSpeed;
            // animate x
            this.xTarget += this.inputAccerlation * 0.05;
            // bounce back when over
            if (this.xTarget > 0)
                this.xTarget += (0 - this.xTarget) * cf.Helpers.lerp(ScrollController.acceleration, 0.3, 0.8);
            if (this.xTarget < this.max)
                this.xTarget += (this.max - this.xTarget) * cf.Helpers.lerp(ScrollController.acceleration, 0.3, 0.8);
            this.x += (this.xTarget - this.x) * 0.4;
            // toggle visibility on nav arrows
            var xRounded = Math.round(this.x);
            if (xRounded < 0) {
                if (!this.prevButton.classList.contains("active"))
                    this.prevButton.classList.add("active");
                if (!this.prevButton.classList.contains("cf-gradient"))
                    this.prevButton.classList.add("cf-gradient");
            }
            if (xRounded == 0) {
                if (this.prevButton.classList.contains("active"))
                    this.prevButton.classList.remove("active");
                if (this.prevButton.classList.contains("cf-gradient"))
                    this.prevButton.classList.remove("cf-gradient");
            }
            if (xRounded > this.max) {
                if (!this.nextButton.classList.contains("active"))
                    this.nextButton.classList.add("active");
                if (!this.nextButton.classList.contains("cf-gradient"))
                    this.nextButton.classList.add("cf-gradient");
            }
            if (xRounded <= this.max) {
                if (this.nextButton.classList.contains("active"))
                    this.nextButton.classList.remove("active");
                if (this.nextButton.classList.contains("cf-gradient"))
                    this.nextButton.classList.remove("cf-gradient");
            }
            // set css transforms
            var xx = this.x;
            cf.Helpers.setTransform(this.listToScroll, "translateX(" + xx + "px)");
            // cycle render
            if (this.interacting || (Math.abs(this.x - this.xTarget) > 0.02 && !this.interacting))
                this.rAF = window.requestAnimationFrame(function () { return _this.render(); });
        };
        ScrollController.prototype.setScroll = function (x, y) {
            this.xTarget = this.visibleAreaWidth == this.listWidth ? 0 : x;
            this.render();
        };
        ScrollController.prototype.pushDirection = function (dir) {
            this.inputAccerlationTarget += (5000) * dir;
            this.render();
        };
        ScrollController.prototype.dealloc = function () {
            this.prevButton.removeEventListener("click", this.onListNavButtonsClickCallback, false);
            this.nextButton.removeEventListener("click", this.onListNavButtonsClickCallback, false);
            this.onListNavButtonsClickCallback = null;
            this.prevButton = null;
            this.nextButton = null;
            document.removeEventListener("mouseleave", this.documentLeaveCallback, false);
            document.removeEventListener(cf.Helpers.getMouseEvent("mouseup"), this.documentLeaveCallback, false);
            this.interactionListener.removeEventListener(cf.Helpers.getMouseEvent("mousedown"), this.onInteractStartCallback, false);
            this.interactionListener.removeEventListener(cf.Helpers.getMouseEvent("mouseup"), this.onInteractEndCallback, false);
            this.interactionListener.removeEventListener(cf.Helpers.getMouseEvent("mousemove"), this.onInteractMoveCallback, false);
            this.documentLeaveCallback = null;
            this.onInteractStartCallback = null;
            this.onInteractEndCallback = null;
            this.onInteractMoveCallback = null;
        };
        ScrollController.prototype.reset = function () {
            this.interacting = false;
            this.startX = 0;
            this.startXTarget = this.startX;
            this.inputAccerlation = 0;
            this.x = 0;
            this.xTarget = 0;
            cf.Helpers.setTransform(this.listToScroll, "translateX(0px)");
            this.render();
            this.prevButton.classList.remove("active");
            this.nextButton.classList.remove("active");
        };
        ScrollController.prototype.resize = function (listWidth, visibleAreaWidth) {
            this.reset();
            this.visibleAreaWidth = visibleAreaWidth;
            this.listWidth = Math.max(visibleAreaWidth, listWidth);
            this.max = (this.listWidth - this.visibleAreaWidth) * -1;
            this.render();
        };
        ScrollController.acceleration = 0.1;
        return ScrollController;
    }());
    cf.ScrollController = ScrollController;
})(cf || (cf = {}));

/// <reference path="../logic/FlowManager.ts"/>
// namespace
var cf;
(function (cf) {
    // interface
    // class
    var ProgressBar = /** @class */ (function () {
        function ProgressBar(options) {
            var _this = this;
            this.flowUpdateCallback = this.onFlowUpdate.bind(this);
            this.eventTarget = options.eventTarget;
            this.eventTarget.addEventListener(cf.FlowEvents.FLOW_UPDATE, this.flowUpdateCallback, false);
            this.eventTarget.addEventListener(cf.FlowEvents.FORM_SUBMIT, function () { return _this.setWidth(100); }, false);
            this.el = document.createElement("div");
            this.el.className = "cf-progressBar";
            this.bar = document.createElement("div");
            this.bar.className = 'bar';
            this.el.appendChild(this.bar);
            setTimeout(function () { return _this.init(); }, 800);
        }
        ProgressBar.prototype.init = function () {
            this.el.classList.add('show');
        };
        ProgressBar.prototype.onFlowUpdate = function (event) {
            this.setWidth(event.detail.step / event.detail.maxSteps * 100);
        };
        ProgressBar.prototype.setWidth = function (percentage) {
            this.bar.style.width = percentage + "%";
        };
        ProgressBar.prototype.dealloc = function () {
            this.eventTarget.removeEventListener(cf.FlowEvents.FLOW_UPDATE, this.flowUpdateCallback, false);
            this.flowUpdateCallback = null;
        };
        return ProgressBar;
    }());
    cf.ProgressBar = ProgressBar;
})(cf || (cf = {}));

/// <reference path="../logic/Helpers.ts"/>
// namespace
var cf;
(function (cf) {
    // class
    var Dictionary = /** @class */ (function () {
        function Dictionary(options) {
            // can be overwrittenMicrophone error
            this.data = {
                "user-image": 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjEwMCIgcj0iMTAwIiBmaWxsPSIjMzAzMDMwIi8+CjxwYXRoIGQ9Ik0xMDAgNTVMMTM4Ljk3MSAxMjIuNUg2MS4wMjg5TDEwMCA1NVoiIGZpbGw9IiNFNUU2RUEiLz4KPC9zdmc+Cg==',
                "entry-not-found": "Dictionary item not found.",
                "awaiting-mic-permission": "Awaiting mic permission",
                "user-audio-reponse-invalid": "I didn't get that, try again.",
                "microphone-terminal-error": "Audio input not supported",
                "input-placeholder": "Type your answer here ...",
                "group-placeholder": "Type to filter ...",
                "input-placeholder-error": "Your input is not correct ...",
                "input-placeholder-required": "Input is required ...",
                "input-placeholder-file-error": "File upload failed ...",
                "input-placeholder-file-size-error": "File size too big ...",
                "input-no-filter": "No results found for ‛{input-value}‛",
                "user-reponse-and": " and ",
                "user-reponse-missing": "Missing input ...",
                "user-reponse-missing-group": "Nothing selected ...",
                "general": "General type1||General type2",
                "icon-type-file": "<svg class='cf-icon-file' viewBox='0 0 10 14' version='1.1' xmlns='http://www.w3.org/2000/svg' xmlns:xlink='http://www.w3.org/1999/xlink'><g stroke='none' stroke-width='1' fill='none' fill-rule='evenodd'><g transform='translate(-756.000000, -549.000000)' fill='#0D83FF'><g transform='translate(736.000000, 127.000000)'><g transform='translate(0.000000, 406.000000)'><polygon points='20 16 26.0030799 16 30 19.99994 30 30 20 30'></polygon></g></g></g></g></svg>",
            };
            // can be overwriten
            this.robotData = {
                "robot-image": 'data:image/svg+xml;base64,PHN2ZyB3aWR0aD0iMjAwIiBoZWlnaHQ9IjIwMCIgdmlld0JveD0iMCAwIDIwMCAyMDAiIGZpbGw9Im5vbmUiIHhtbG5zPSJodHRwOi8vd3d3LnczLm9yZy8yMDAwL3N2ZyI+CjxjaXJjbGUgY3g9IjEwMCIgY3k9IjEwMCIgcj0iMTAwIiBmaWxsPSIjRTVFNkVBIi8+CjxyZWN0IHg9IjY2IiB5PSI2NiIgd2lkdGg9IjY4IiBoZWlnaHQ9IjY4IiBmaWxsPSIjMzAzMDMwIi8+Cjwvc3ZnPgo=',
                "input": "Please write some text.",
                "text": "Please write some text.",
                "textarea": "Please write some text.",
                "checkbox": "Select as many as you want.",
                "name": "What's your name?",
                "email": "Need your e-mail.",
                "password": "Please provide password",
                "tel": "What's your phone number?",
                "radio": "I need you to select one of these.",
                "select": "Choose any of these options.",
                "file": "Select a file to upload.",
                "general": "General1||General2||General3.."
            };
            Dictionary.instance = this;
            this.version = options.version;
            // overwrite data if defined 
            if (options && options.data)
                this.data = this.validateAndSetNewData(options.data, this.data);
            // overwrite user image
            if (options.userImage) {
                this.data["user-image"] = options.userImage;
            }
            else {
                this.data['user-image'] = this.data['user-image'];
            }
            // overwrite robot image
            if (options.robotImage) {
                this.robotData["robot-image"] = options.robotImage;
            }
            else {
                this.robotData['robot-image'] = this.robotData['robot-image'];
            }
            // overwrite robot questions if defined
            if (options && options.robotData)
                this.robotData = this.validateAndSetNewData(options.robotData, this.robotData);
        }
        Dictionary.get = function (id) {
            var ins = Dictionary.instance;
            var value = ins.data[id];
            if (!value) {
                value = ins.data["entry-not-found"];
            }
            else {
                var values = cf.Helpers.getValuesOfBars(value);
                value = values[Math.floor(Math.random() * values.length)];
            }
            return value;
        };
        /**
        * @name set
        * set a dictionary value
        *	id: string, id of the value to update
        *	type: string, "human" || "robot"
        *	value: string, value to be inserted
        */
        Dictionary.set = function (id, type, value) {
            var ins = Dictionary.instance;
            var obj = type == "robot" ? ins.robotData : ins.data;
            obj[id] = value;
            return obj[id];
        };
        Dictionary.getRobotResponse = function (tagType) {
            var ins = Dictionary.instance;
            var value = ins.robotData[tagType];
            if (!value) {
                // value not found, so pick a general one
                var generals = cf.Helpers.getValuesOfBars(ins.robotData["general"]);
                value = generals[Math.floor(Math.random() * generals.length)];
            }
            else {
                var values = cf.Helpers.getValuesOfBars(value);
                value = values[Math.floor(Math.random() * values.length)];
            }
            return value;
        };
        Dictionary.parseAndGetMultiValueString = function (arr) {
            // check ControlElement.ts for value(s)
            var value = "";
            for (var i = 0; i < arr.length; i++) {
                var str = arr[i];
                var sym = (arr.length > 1 && i == arr.length - 2 ? Dictionary.get("user-reponse-and") : ", ");
                value += str + (i < arr.length - 1 ? sym : "");
            }
            return value;
        };
        Dictionary.prototype.validateAndSetNewData = function (newData, originalDataObject) {
            for (var key in originalDataObject) {
                if (!newData[key]) {
                    console.warn("Conversational Form Dictionary warning, '" + key + "' value is undefined, mapping '" + key + "' to default value. See Dictionary.ts for keys.");
                    newData[key] = originalDataObject[key];
                }
            }
            return newData;
        };
        Dictionary.keyCodes = {
            "left": 37,
            "right": 39,
            "down": 40,
            "up": 38,
            "backspace": 8,
            "enter": 13,
            "space": 32,
            "shift": 16,
            "tab": 9,
        };
        return Dictionary;
    }());
    cf.Dictionary = Dictionary;
})(cf || (cf = {}));

/// <reference path="../data/Dictionary.ts"/>
/// <reference path="InputTag.ts"/>
/// <reference path="ButtonTag.ts"/>
/// <reference path="SelectTag.ts"/>
/// <reference path="OptionTag.ts"/>
/// <reference path="CfRobotMessageTag.ts"/>
/// <reference path="../ConversationalForm.ts"/>
/// <reference path="../logic/EventDispatcher.ts"/>
/// <reference path="../parsing/TagsParser.ts"/>
// basic tag from form logic
// types:
// radio
// text
// email
// tel
// password
// checkbox
// radio
// select
// button
// namespace
var cf;
(function (cf) {
    cf.TagEvents = {
        ORIGINAL_ELEMENT_CHANGED: "cf-tag-dom-element-changed"
    };
    // class
    var Tag = /** @class */ (function () {
        function Tag(options) {
            this.domElement = options.domElement;
            this.initialDefaultValue = this.domElement.value || this.domElement.getAttribute("value") || "";
            this.changeCallback = this.onDomElementChange.bind(this);
            this.domElement.addEventListener("change", this.changeCallback, false);
            // remove tabIndex from the dom element.. danger zone... should we or should we not...
            this.domElement.tabIndex = -1;
            this.skipUserInput = false;
            // questions array
            if (options.questions)
                this.questions = options.questions;
            // custom tag validation - must be a method on window to avoid unsafe eval() calls
            if (this.domElement.getAttribute("cf-validation")) {
                var fn = window[this.domElement.getAttribute("cf-validation")];
                this.validationCallback = fn;
            }
            // reg ex pattern is set on the Tag, so use it in our validation
            if (this.domElement.getAttribute("pattern"))
                this.pattern = new RegExp(this.domElement.getAttribute("pattern"));
            if (this.type != "group" && cf.ConversationalForm.illustrateAppFlow) {
                if (!cf.ConversationalForm.suppressLog)
                    console.log('Conversational Form > Tag registered:', this.type, this);
            }
            this.refresh();
        }
        Object.defineProperty(Tag.prototype, "type", {
            get: function () {
                return this.domElement.getAttribute("type") || this.domElement.tagName.toLowerCase();
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Tag.prototype, "name", {
            get: function () {
                return this.domElement.getAttribute("name");
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Tag.prototype, "id", {
            get: function () {
                return this.domElement.getAttribute("id");
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Tag.prototype, "inputPlaceholder", {
            get: function () {
                return this._inputPlaceholder;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Tag.prototype, "formless", {
            get: function () {
                return cf.TagsParser.isElementFormless(this.domElement);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Tag.prototype, "label", {
            get: function () {
                return this.getLabel();
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Tag.prototype, "value", {
            get: function () {
                return this.domElement.value || this.initialDefaultValue;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Tag.prototype, "hasImage", {
            get: function () {
                return this.domElement.hasAttribute("cf-image");
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Tag.prototype, "rows", {
            get: function () {
                return this.domElement.hasAttribute("rows") ? parseInt(this.domElement.getAttribute("rows")) : 0;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Tag.prototype, "disabled", {
            get: function () {
                // a tag is disabled if its conditions are not meet, also if it contains the disabled attribute
                return !this.checkConditionalAndIsValid() || (this.domElement.getAttribute("disabled") != undefined && this.domElement.getAttribute("disabled") != null);
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Tag.prototype, "required", {
            get: function () {
                return !!this.domElement.getAttribute("required") || this.domElement.getAttribute("required") == "";
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Tag.prototype, "question", {
            get: function () {
                // if questions are empty, then fall back to dictionary, every time
                if (!this.questions || this.questions.length == 0)
                    return cf.Dictionary.getRobotResponse(this.type);
                else
                    return this.questions[Math.floor(Math.random() * this.questions.length)];
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Tag.prototype, "eventTarget", {
            set: function (value) {
                this._eventTarget = value;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(Tag.prototype, "errorMessage", {
            get: function () {
                if (!this.errorMessages) {
                    // custom tag error messages
                    if (this.domElement.getAttribute("cf-error")) {
                        this.errorMessages = cf.Helpers.getValuesOfBars(this.domElement.getAttribute("cf-error"));
                    }
                    else if (this.domElement.parentNode && this.domElement.parentNode.getAttribute("cf-error")) {
                        this.errorMessages = cf.Helpers.getValuesOfBars(this.domElement.parentNode.getAttribute("cf-error"));
                    }
                    else if (this.required) {
                        this.errorMessages = [cf.Dictionary.get("input-placeholder-required")];
                    }
                    else {
                        if (this.type == "file")
                            this.errorMessages = [cf.Dictionary.get("input-placeholder-file-error")];
                        else {
                            this.errorMessages = [cf.Dictionary.get("input-placeholder-error")];
                        }
                    }
                }
                return this.errorMessages[Math.floor(Math.random() * this.errorMessages.length)];
            },
            enumerable: true,
            configurable: true
        });
        Tag.prototype.dealloc = function () {
            this.domElement.removeEventListener("change", this.changeCallback, false);
            this.changeCallback = null;
            this.domElement = null;
            this.defaultValue = null;
            this.errorMessages = null;
            this.pattern = null;
            this._label = null;
            this.validationCallback = null;
            this.questions = null;
        };
        Tag.testConditions = function (tagValue, condition) {
            var testValue = function (value, conditional) {
                if (typeof conditional === "object") {
                    // regex
                    return conditional.test(value);
                }
                // string comparisson
                return tagValue === conditional;
            };
            if (typeof tagValue === "string") {
                // tag value is a string
                var value = tagValue;
                var isValid = false;
                for (var i = 0; i < condition.conditionals.length; i++) {
                    var conditional = condition.conditionals[i];
                    isValid = testValue(value, conditional);
                    if (isValid)
                        break;
                }
                return isValid;
            }
            else {
                if (!tagValue) {
                    return false;
                }
                else {
                    // tag value is an array
                    var isValid = false;
                    for (var i = 0; i < condition.conditionals.length; i++) {
                        var conditional = condition.conditionals[i];
                        if (typeof tagValue !== "string") {
                            for (var j = 0; j < tagValue.length; j++) {
                                isValid = testValue(tagValue[j], conditional);
                                if (isValid)
                                    break;
                            }
                        }
                        else {
                            // string comparisson
                            isValid = testValue(tagValue.toString(), conditional);
                        }
                        if (isValid)
                            break;
                    }
                    return isValid;
                }
                // arrays need to be the same
            }
        };
        Tag.isTagValid = function (element) {
            if (element.getAttribute("type") === "hidden")
                return false;
            if (element.getAttribute("type") === "submit")
                return false;
            // ignore buttons, we submit the form automatially
            if (element.getAttribute("type") == "button")
                return false;
            if (element.style) {
                // element style can be null if markup is created from DOMParser
                if (element.style.display === "none")
                    return false;
                if (element.style.visibility === "hidden")
                    return false;
            }
            var isTagFormless = cf.TagsParser.isElementFormless(element);
            var innerText = cf.Helpers.getInnerTextOfElement(element);
            if (element.tagName.toLowerCase() == "option" && (!isTagFormless && innerText == "" || innerText == " ")) {
                return false;
            }
            if (element.tagName.toLowerCase() == "select" || element.tagName.toLowerCase() == "option")
                return true;
            else if (isTagFormless) {
                return true;
            }
            else {
                return !!(element.offsetWidth || element.offsetHeight || element.getClientRects().length);
            }
        };
        Tag.createTag = function (element) {
            if (Tag.isTagValid(element)) {
                // ignore hidden tags
                var tag = void 0;
                if (element.tagName.toLowerCase() == "input") {
                    tag = new cf.InputTag({
                        domElement: element
                    });
                }
                else if (element.tagName.toLowerCase() == "textarea") {
                    tag = new cf.InputTag({
                        domElement: element
                    });
                }
                else if (element.tagName.toLowerCase() == "select") {
                    tag = new cf.SelectTag({
                        domElement: element
                    });
                }
                else if (element.tagName.toLowerCase() == "button") {
                    tag = new cf.ButtonTag({
                        domElement: element
                    });
                }
                else if (element.tagName.toLowerCase() == "option") {
                    tag = new cf.OptionTag({
                        domElement: element
                    });
                }
                else if (element.tagName.toLowerCase() == "cf-robot-message") {
                    tag = new cf.CfRobotMessageTag({
                        domElement: element
                    });
                }
                return tag;
            }
            else {
                // console.warn("Tag is not valid!: "+ element);
                return null;
            }
        };
        Tag.prototype.reset = function () {
            this.refresh();
            // this.disabled = false;
            // reset to initial value.
            this.defaultValue = this.domElement.value = this.initialDefaultValue.toString();
        };
        Tag.prototype.refresh = function () {
            // default value of Tag, check every refresh
            this.defaultValue = this.domElement.value || this.domElement.getAttribute("value") || "";
            this.questions = null;
            this.findAndSetQuestions();
            this.findConditionalAttributes();
        };
        Tag.prototype.hasConditionsFor = function (tagName) {
            if (!this.hasConditions()) {
                return false;
            }
            for (var i = 0; i < this.conditionalTags.length; i++) {
                var condition = this.conditionalTags[i];
                if ("cf-conditional-" + tagName.toLowerCase() === condition.key.toLowerCase()) {
                    return true;
                }
            }
            return false;
        };
        Tag.prototype.hasConditions = function () {
            return this.conditionalTags && this.conditionalTags.length > 0;
        };
        /**
        * @name checkConditionalAndIsValid
        * checks for conditional logic, see documentaiton (wiki)
        * here we check after cf-conditional{-name}, if we find an attribute we look through tags for value, and ignore the tag if
        */
        Tag.prototype.checkConditionalAndIsValid = function () {
            // can we tap into disabled
            // if contains attribute, cf-conditional{-name} then check for conditional value across tags
            if (this.hasConditions()) {
                return this.flowManager.areConditionsInFlowFullfilled(this, this.conditionalTags);
            }
            // else return true, as no conditional means uncomplicated and happy tag
            return true;
        };
        Tag.prototype.setTagValueAndIsValid = function (dto) {
            // this sets the value of the tag in the DOM
            // validation
            var isValid = true;
            var valueText = dto.text;
            if (this.domElement.hasAttribute('type')
                && this.domElement.getAttribute('type') === 'email'
                && !this.pattern
                && valueText.length > 0) {
                this.pattern = /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
            }
            else if (
            // When NOT required: Reset in the event user already typed something, and now they clear their input and want to submit nothing ==> remove pattern previously applied
            this.domElement.hasAttribute('type')
                && this.domElement.getAttribute('type') === 'email'
                && this.pattern
                && valueText.length === 0
                && !this.required) {
                this.pattern = null;
            }
            if (this.pattern) {
                isValid = this.pattern.test(valueText);
            }
            if (valueText == "" && this.required) {
                isValid = false;
            }
            // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-minlength
            var min = parseInt(this.domElement.getAttribute("minlength"), 10) || -1;
            // https://developer.mozilla.org/en-US/docs/Web/HTML/Element/input#attr-maxlength
            var max = parseInt(this.domElement.getAttribute("maxlength"), 10) || -1;
            if (min != -1 && valueText.length < min) {
                isValid = false;
            }
            if (max != -1 && valueText.length > max) {
                isValid = false;
            }
            var isMaxMinValueValid = this.validateMaxMinValue(valueText);
            if (!isMaxMinValueValid)
                isValid = false;
            if (isValid) {
                // we cannot set the dom element value when type is file
                if (this.type != "file")
                    this.domElement.value = valueText;
            }
            return isValid;
        };
        /**
         * Validates value against tag max and min attributes
         *
         * @private
         * @param {string} value
         * @returns {boolean}
         * @memberof Tag
         */
        Tag.prototype.validateMaxMinValue = function (value) {
            if (!value)
                return true;
            var parsedValue = parseInt(value, 10);
            var minValue = parseInt(this.domElement.getAttribute("min"), 10) || -1;
            var maxValue = parseInt(this.domElement.getAttribute("max"), 10) || -1;
            if (minValue !== -1 && parsedValue < minValue)
                return false;
            if (maxValue !== -1 && parsedValue > maxValue)
                return false;
            return true;
        };
        Tag.prototype.getLabel = function () {
            if (!this._label)
                this.findAndSetLabel();
            if (this._label)
                return this._label;
            return cf.Dictionary.getRobotResponse(this.type);
        };
        /**
        * @name findConditionalAttributes
        * look for conditional attributes and map them
        */
        Tag.prototype.findConditionalAttributes = function () {
            var keys = this.domElement.attributes;
            if (keys.length > 0) {
                this.conditionalTags = [];
                for (var key in keys) {
                    if (keys.hasOwnProperty(key)) {
                        var attr = keys[key];
                        if (attr && attr.name && attr.name.indexOf("cf-conditional") !== -1) {
                            // conditional found
                            var _conditionals = [];
                            // TODO: when && use to combine multiple values to complete condition.
                            var conditionalsFromAttribute = attr.value.indexOf("||") !== -1 ? attr.value.split("||") : attr.value.split("&&");
                            for (var i = 0; i < conditionalsFromAttribute.length; i++) {
                                var _conditional = conditionalsFromAttribute[i];
                                try {
                                    _conditionals.push(new RegExp(_conditional));
                                }
                                catch (e) {
                                }
                                _conditionals.push(_conditional);
                            }
                            this.conditionalTags.push({
                                key: attr.name,
                                conditionals: _conditionals
                            });
                        }
                    }
                }
            }
        };
        Tag.prototype.findAndSetQuestions = function () {
            if (this.questions)
                return;
            // <label tag with label:for attribute to el:id
            // check for label tag, we only go 2 steps backwards..
            // from standardize markup: http://www.w3schools.com/tags/tag_label.asp
            if (this.domElement.getAttribute("cf-questions")) {
                this.questions = cf.Helpers.getValuesOfBars(this.domElement.getAttribute("cf-questions"));
                if (this.domElement.getAttribute("cf-input-placeholder"))
                    this._inputPlaceholder = this.domElement.getAttribute("cf-input-placeholder");
            }
            else if (this.domElement.parentNode && this.domElement.parentNode.getAttribute("cf-questions")) {
                // for groups the parentNode can have the cf-questions..
                var parent_1 = this.domElement.parentNode;
                this.questions = cf.Helpers.getValuesOfBars(parent_1.getAttribute("cf-questions"));
                if (parent_1.getAttribute("cf-input-placeholder"))
                    this._inputPlaceholder = parent_1.getAttribute("cf-input-placeholder");
            }
            else {
                // questions not set, so find it in the DOM
                // try a broader search using for and id attributes
                var elId = this.domElement.getAttribute("id");
                var forLabel = document.querySelector("label[for='" + elId + "']");
                if (forLabel) {
                    this.questions = [cf.Helpers.getInnerTextOfElement(forLabel)];
                }
            }
            if (!this.questions && this.domElement.getAttribute("placeholder")) {
                // check for placeholder attr if questions are still undefined
                this.questions = [this.domElement.getAttribute("placeholder")];
            }
        };
        Tag.prototype.findAndSetLabel = function () {
            // find label..
            if (this.domElement.getAttribute("cf-label")) {
                this._label = this.domElement.getAttribute("cf-label");
            }
            else {
                var parentDomNode = this.domElement.parentNode;
                if (parentDomNode) {
                    // step backwards and check for label tag.
                    var labelTags = parentDomNode.tagName.toLowerCase() == "label" ? [parentDomNode] : parentDomNode.getElementsByTagName("label");
                    if (labelTags.length == 0) {
                        // check for innerText
                        var innerText = cf.Helpers.getInnerTextOfElement(parentDomNode);
                        if (innerText && innerText.length > 0)
                            labelTags = [parentDomNode];
                    }
                    else if (labelTags.length > 0) {
                        // check for "for" attribute
                        for (var i = 0; i < labelTags.length; i++) {
                            var label = labelTags[i];
                            if (label.getAttribute("for") == this.id) {
                                this._label = cf.Helpers.getInnerTextOfElement(label);
                            }
                        }
                    }
                    if (!this._label && labelTags[0]) {
                        this._label = cf.Helpers.getInnerTextOfElement(labelTags[0]);
                    }
                }
            }
        };
        /**
        * @name onDomElementChange
        * on dom element value change event, ex. w. browser autocomplete mode
        */
        Tag.prototype.onDomElementChange = function () {
            this._eventTarget.dispatchEvent(new CustomEvent(cf.TagEvents.ORIGINAL_ELEMENT_CHANGED, {
                detail: {
                    value: this.value,
                    tag: this
                }
            }));
        };
        return Tag;
    }());
    cf.Tag = Tag;
})(cf || (cf = {}));

/// <reference path="ButtonTag.ts"/>
/// <reference path="InputTag.ts"/>
/// <reference path="SelectTag.ts"/>
/// <reference path="../ui/inputs/UserTextInput.ts"/>
// group tags together, this is done automatically by looking through InputTags with type radio or checkbox and same name attribute.
// single choice logic for Radio Button, <input type="radio", where name is the same
// multi choice logic for Checkboxes, <input type="checkbox", where name is the same
// namespace
var cf;
(function (cf) {
    // class
    var TagGroup = /** @class */ (function () {
        function TagGroup(options) {
            this.elements = options.elements;
            // set wrapping element
            this._fieldset = options.fieldset;
            if (this._fieldset && this._fieldset.getAttribute("cf-questions")) {
                this.questions = cf.Helpers.getValuesOfBars(this._fieldset.getAttribute("cf-questions"));
            }
            if (this._fieldset && this._fieldset.getAttribute("cf-input-placeholder")) {
                this._inputPlaceholder = this._fieldset.getAttribute("cf-input-placeholder");
            }
            if (cf.ConversationalForm.illustrateAppFlow)
                if (!cf.ConversationalForm.suppressLog)
                    console.log('Conversational Form > TagGroup registered:', this.elements[0].type, this);
            this.skipUserInput = false;
        }
        Object.defineProperty(TagGroup.prototype, "required", {
            get: function () {
                for (var i = 0; i < this.elements.length; i++) {
                    var element = this.elements[i];
                    if (this.elements[i].required) {
                        return true;
                    }
                }
                return false;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TagGroup.prototype, "eventTarget", {
            set: function (value) {
                this._eventTarget = value;
                for (var i = 0; i < this.elements.length; i++) {
                    var tag = this.elements[i];
                    tag.eventTarget = value;
                }
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TagGroup.prototype, "flowManager", {
            set: function (value) {
                for (var i = 0; i < this.elements.length; i++) {
                    var tag = this.elements[i];
                    tag.flowManager = value;
                }
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TagGroup.prototype, "type", {
            get: function () {
                return "group";
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TagGroup.prototype, "label", {
            get: function () {
                return "";
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TagGroup.prototype, "name", {
            get: function () {
                return this._fieldset && this._fieldset.hasAttribute("name") ? this._fieldset.getAttribute("name") : this.elements[0].name;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TagGroup.prototype, "id", {
            get: function () {
                return this._fieldset && this._fieldset.id ? this._fieldset.id : this.elements[0].id;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TagGroup.prototype, "question", {
            get: function () {
                // check if elements have the questions, else fallback
                if (this.questions && this.questions.length > 0) {
                    return this.questions[Math.floor(Math.random() * this.questions.length)];
                }
                else if (this.elements[0] && this.elements[0].question) {
                    var tagQuestion = this.elements[0].question;
                    return tagQuestion;
                }
                else {
                    // fallback to robot response from dictionary
                    var robotReponse = cf.Dictionary.getRobotResponse(this.getGroupTagType());
                    return robotReponse;
                }
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TagGroup.prototype, "activeElements", {
            get: function () {
                return this._activeElements;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TagGroup.prototype, "value", {
            get: function () {
                // TODO: fix value???
                return this._values ? this._values : [""];
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TagGroup.prototype, "disabled", {
            get: function () {
                var disabled = false;
                var allShouldBedisabled = 0;
                for (var i = 0; i < this.elements.length; i++) {
                    var element = this.elements[i];
                    if (element.disabled)
                        allShouldBedisabled++;
                }
                return allShouldBedisabled === this.elements.length;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TagGroup.prototype, "errorMessage", {
            get: function () {
                var errorMessage = cf.Dictionary.get("input-placeholder-error");
                for (var i = 0; i < this.elements.length; i++) {
                    var element = this.elements[i];
                    errorMessage = element.errorMessage;
                }
                return errorMessage;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(TagGroup.prototype, "inputPlaceholder", {
            get: function () {
                return this._inputPlaceholder;
            },
            enumerable: true,
            configurable: true
        });
        TagGroup.prototype.dealloc = function () {
            for (var i = 0; i < this.elements.length; i++) {
                var element = this.elements[i];
                element.dealloc();
            }
            this.elements = null;
        };
        TagGroup.prototype.refresh = function () {
            for (var i = 0; i < this.elements.length; i++) {
                var element = this.elements[i];
                element.refresh();
            }
        };
        TagGroup.prototype.reset = function () {
            this._values = [];
            for (var i = 0; i < this.elements.length; i++) {
                var element = this.elements[i];
                element.reset();
            }
        };
        TagGroup.prototype.getGroupTagType = function () {
            return this.elements[0].type;
        };
        TagGroup.prototype.hasConditionsFor = function (tagName) {
            for (var i = 0; i < this.elements.length; i++) {
                var element = this.elements[i];
                if (element.hasConditionsFor(tagName)) {
                    return true;
                }
            }
            return false;
        };
        TagGroup.prototype.hasConditions = function () {
            for (var i = 0; i < this.elements.length; i++) {
                var element = this.elements[i];
                if (element.hasConditions()) {
                    return true;
                }
            }
            return false;
        };
        /**
        * @name checkConditionalAndIsValid
        * checks for conditional logic, see documentaiton (wiki)
        * here we check after cf-conditional{-name} on group tags
        */
        TagGroup.prototype.checkConditionalAndIsValid = function () {
            // can we tap into disabled
            // if contains attribute, cf-conditional{-name} then check for conditional value across tags
            for (var i = 0; i < this.elements.length; i++) {
                var element = this.elements[i];
                element.checkConditionalAndIsValid();
            }
            // else return true, as no conditional means happy tag
            return true;
        };
        TagGroup.prototype.setTagValueAndIsValid = function (dto) {
            var isValid = false;
            var groupType = this.elements[0].type;
            this._values = [];
            this._activeElements = [];
            switch (groupType) {
                case "radio":
                    var wasRadioButtonChecked = false;
                    var numberRadioButtonsVisible = [];
                    if (dto.controlElements) {
                        // TODO: Refactor this so it is less dependant on controlElements
                        for (var i = 0; i < dto.controlElements.length; i++) {
                            var element = dto.controlElements[i];
                            var tag = this.elements[this.elements.indexOf(element.referenceTag)];
                            numberRadioButtonsVisible.push(element);
                            if (tag == element.referenceTag) {
                                if (element.checked) {
                                    this._values.push(tag.value);
                                    this._activeElements.push(tag);
                                }
                                // a radio button was checked
                                if (!wasRadioButtonChecked && element.checked)
                                    wasRadioButtonChecked = true;
                            }
                        }
                    }
                    else {
                        // for when we don't have any control elements, then we just try and map values
                        for (var i = 0; i < this.elements.length; i++) {
                            var tag = this.elements[i];
                            var v1 = tag.value.toString().toLowerCase();
                            var v2 = dto.text.toString().toLowerCase();
                            //brute force checking...
                            if (v1.indexOf(v2) !== -1 || v2.indexOf(v1) !== -1) {
                                this._activeElements.push(tag);
                                // check the original tag
                                this._values.push(tag.value);
                                tag.domElement.checked = true;
                                wasRadioButtonChecked = true;
                            }
                        }
                    }
                    isValid = wasRadioButtonChecked;
                    break;
                case "checkbox":
                    // checkbox is always valid
                    isValid = true;
                    if (dto.controlElements) {
                        for (var i = 0; i < dto.controlElements.length; i++) {
                            var element = dto.controlElements[i];
                            var tag = this.elements[this.elements.indexOf(element.referenceTag)];
                            tag.domElement.checked = element.checked;
                            if (element.checked) {
                                this._values.push(tag.value);
                                this._activeElements.push(tag);
                            }
                        }
                    }
                    if (this.required && this._activeElements.length == 0) {
                        // checkbox can be required
                        isValid = false;
                    }
                    break;
            }
            return isValid;
        };
        return TagGroup;
    }());
    cf.TagGroup = TagGroup;
})(cf || (cf = {}));

/// <reference path="Tag.ts"/>
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
// namespace
var cf;
(function (cf) {
    // interface
    // class
    var InputTag = /** @class */ (function (_super) {
        __extends(InputTag, _super);
        function InputTag(options) {
            var _this = _super.call(this, options) || this;
            if (_this.type == "text") {
            }
            else if (_this.type == "email") {
            }
            else if (_this.type == "tel") {
            }
            else if (_this.type == "checkbox") {
            }
            else if (_this.type == "radio") {
            }
            else if (_this.type == "password") {
            }
            else if (_this.type == "file") {
                // check InputFileTag.ts
            }
            return _this;
        }
        InputTag.prototype.findAndSetQuestions = function () {
            _super.prototype.findAndSetQuestions.call(this);
            // special use cases for <input> tag add here...
        };
        InputTag.prototype.findAndSetLabel = function () {
            _super.prototype.findAndSetLabel.call(this);
            if (!this._label) {
                // special use cases for <input> tag add here...
            }
        };
        InputTag.prototype.setTagValueAndIsValid = function (value) {
            if (this.type == "checkbox") {
                // checkbox is always true..
                return true;
            }
            else {
                return _super.prototype.setTagValueAndIsValid.call(this, value);
            }
        };
        InputTag.prototype.dealloc = function () {
            _super.prototype.dealloc.call(this);
        };
        return InputTag;
    }(cf.Tag));
    cf.InputTag = InputTag;
})(cf || (cf = {}));

/// <reference path="Tag.ts"/>
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
// namespace
var cf;
(function (cf) {
    // interface
    // class
    var SelectTag = /** @class */ (function (_super) {
        __extends(SelectTag, _super);
        function SelectTag(options) {
            var _this = _super.call(this, options) || this;
            // build the option tags
            _this.optionTags = [];
            var domOptionTags = _this.domElement.getElementsByTagName("option");
            for (var i = 0; i < domOptionTags.length; i++) {
                var element = domOptionTags[i];
                var tag = cf.Tag.createTag(element);
                if (tag) {
                    _this.optionTags.push(tag);
                }
                else {
                    console.warn(_this.constructor.name, 'option tag invalid:', tag);
                }
            }
            return _this;
        }
        SelectTag.prototype.getWeightedScore = function (input, target, threshold) {
            var inputLower = input.toLowerCase().trim();
            var targetLower = target.toLowerCase().trim();
            if (!inputLower || !targetLower)
                return 0;
            // Exact match - highest priority
            if (inputLower === targetLower)
                return 1.0;
            // Starts with (prefix match) - very high score
            if (targetLower.startsWith(inputLower))
                return 0.95;
            // Ends with (suffix match) - high score
            if (targetLower.endsWith(inputLower))
                return 0.90;
            // Fuzzy match using fast-fuzzy
            return FastFuzzy.fuzzy(inputLower, targetLower, { threshold: threshold });
        };
        Object.defineProperty(SelectTag.prototype, "type", {
            get: function () {
                return "select";
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(SelectTag.prototype, "name", {
            get: function () {
                return this.domElement && this.domElement.hasAttribute("name") ? this.domElement.getAttribute("name") : this.optionTags[0].name;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(SelectTag.prototype, "value", {
            get: function () {
                return this._values;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(SelectTag.prototype, "multipleChoice", {
            get: function () {
                return this.domElement.hasAttribute("multiple");
            },
            enumerable: false,
            configurable: true
        });
        SelectTag.prototype.setTagValueAndIsValid = function (dto) {
            var isValid = false;
            // select tag values are set via selected attribute on option tag
            var numberOptionButtonsVisible = [];
            this._values = [];
            if (dto.controlElements) {
                // TODO: Refactor this so it is less dependant on controlElements
                for (var i = 0; i < this.optionTags.length; i++) {
                    var tag = this.optionTags[i];
                    for (var j = 0; j < dto.controlElements.length; j++) {
                        var controllerElement = dto.controlElements[j];
                        if (controllerElement.referenceTag == tag) {
                            // tag match found, so set value
                            tag.selected = controllerElement.selected;
                            // check for minimum one selected
                            if (!isValid && tag.selected)
                                isValid = true;
                            if (tag.selected)
                                this._values.push(tag.value);
                            if (controllerElement.visible)
                                numberOptionButtonsVisible.push(controllerElement);
                        }
                    }
                }
            }
            else {
                // for when we don't have any control elements, use fuzzy matching to map values
                var bestMatch = null;
                var bestScore = 0;
                var threshold = 0.6;
                var userText = dto.text.toString();
                for (var i = 0; i < this.optionTags.length; i++) {
                    var tag = this.optionTags[i];
                    var optionValue = tag.value.toString();
                    var labelText = tag.label || '';
                    // Check both value and label with weighted scoring
                    var valueScore = this.getWeightedScore(userText, optionValue, threshold);
                    var labelScore = this.getWeightedScore(userText, labelText, threshold);
                    // Take the higher of the two scores
                    var maxScore = Math.max(valueScore, labelScore);
                    // Track the best match
                    if (maxScore > bestScore) {
                        bestScore = maxScore;
                        bestMatch = tag;
                    }
                }
                // Select only the best match if it meets the threshold
                if (bestMatch && bestScore >= threshold) {
                    this._values.push(bestMatch.value);
                    bestMatch.domElement.checked = true;
                    isValid = true;
                }
            }
            // special case 1, only one optiontag visible from a filter
            if (!isValid && numberOptionButtonsVisible.length == 1) {
                var element = numberOptionButtonsVisible[0];
                var tag = this.optionTags[this.optionTags.indexOf(element.referenceTag)];
                element.selected = true;
                tag.selected = true;
                isValid = true;
                if (tag.selected)
                    this._values.push(tag.value);
            }
            return isValid;
        };
        return SelectTag;
    }(cf.Tag));
    cf.SelectTag = SelectTag;
})(cf || (cf = {}));

/// <reference path="Tag.ts"/>
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
// namespace
var cf;
(function (cf) {
    // interface
    // class
    var ButtonTag = /** @class */ (function (_super) {
        __extends(ButtonTag, _super);
        function ButtonTag(options) {
            var _this = _super.call(this, options) || this;
            if (_this.domElement.getAttribute("type") == "submit") {
            }
            else if (_this.domElement.getAttribute("type") == "button") {
                // this.onClick = eval(this.domElement.onclick);
            }
            return _this;
        }
        return ButtonTag;
    }(cf.Tag));
    cf.ButtonTag = ButtonTag;
})(cf || (cf = {}));

/// <reference path="Tag.ts"/>
/// <reference path="../parsing/TagsParser.ts"/>
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
// namespace
var cf;
(function (cf) {
    // interface
    // class
    var OptionTag = /** @class */ (function (_super) {
        __extends(OptionTag, _super);
        function OptionTag() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        Object.defineProperty(OptionTag.prototype, "type", {
            get: function () {
                return "option";
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(OptionTag.prototype, "label", {
            get: function () {
                if (this.formless) {
                    return _super.prototype.getLabel.call(this);
                }
                else {
                    return cf.Helpers.getInnerTextOfElement(this.domElement);
                }
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(OptionTag.prototype, "selected", {
            get: function () {
                return this.domElement.hasAttribute("selected");
                // return (<HTMLOptionElement> this.domElement).selected;
            },
            set: function (value) {
                this.domElement.selected = value;
                if (value) {
                    this.domElement.setAttribute("selected", "selected");
                }
                else {
                    this.domElement.removeAttribute("selected");
                }
            },
            enumerable: true,
            configurable: true
        });
        OptionTag.prototype.setTagValueAndIsValid = function (value) {
            var isValid = true;
            // OBS: No need to set any validation og value for this tag type ..
            // .. it is atm. only used to create pseudo elements in the OptionsList
            return isValid;
        };
        return OptionTag;
    }(cf.Tag));
    cf.OptionTag = OptionTag;
})(cf || (cf = {}));

/// <reference path="Tag.ts"/>
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
// namespace
var cf;
(function (cf) {
    // interface
    // class
    var CfRobotMessageTag = /** @class */ (function (_super) {
        __extends(CfRobotMessageTag, _super);
        function CfRobotMessageTag(options) {
            var _this = _super.call(this, options) || this;
            _this.skipUserInput = true;
            return _this;
        }
        CfRobotMessageTag.prototype.dealloc = function () {
            _super.prototype.dealloc.call(this);
        };
        return CfRobotMessageTag;
    }(cf.Tag));
    cf.CfRobotMessageTag = CfRobotMessageTag;
})(cf || (cf = {}));

/// <reference path="ControlElement.ts"/>
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
// namespace
var cf;
(function (cf) {
    // interface
    // class
    var Button = /** @class */ (function (_super) {
        __extends(Button, _super);
        function Button(options) {
            var _this = _super.call(this, options) || this;
            _this.clickCallback = _this.onClick.bind(_this);
            _this.el.addEventListener("click", _this.clickCallback, false);
            _this.mouseDownCallback = _this.onMouseDown.bind(_this);
            _this.el.addEventListener("mousedown", _this.mouseDownCallback, false);
            //image
            _this.checkForImage();
            return _this;
        }
        Object.defineProperty(Button.prototype, "type", {
            get: function () {
                return "Button";
            },
            enumerable: true,
            configurable: true
        });
        Button.prototype.hasImage = function () {
            return this.referenceTag.hasImage;
        };
        /**
        * @name checkForImage
        * checks if element has cf-image, if it has then change UI
        */
        Button.prototype.checkForImage = function () {
            var hasImage = this.hasImage();
            if (hasImage) {
                this.el.classList.add("has-image");
                this.imgEl = document.createElement("img");
                this.imageLoadedCallback = this.onImageLoaded.bind(this);
                this.imgEl.classList.add("cf-image");
                this.imgEl.addEventListener("load", this.imageLoadedCallback, false);
                this.imgEl.src = this.referenceTag.domElement.getAttribute("cf-image");
                this.el.insertBefore(this.imgEl, this.el.children[0]);
            }
        };
        Button.prototype.onImageLoaded = function () {
            this.imgEl.classList.add("loaded");
            this.eventTarget.dispatchEvent(new CustomEvent(cf.ControlElementEvents.ON_LOADED, {}));
        };
        Button.prototype.onMouseDown = function (event) {
            event.preventDefault();
        };
        Button.prototype.onClick = function (event) {
            this.onChoose();
        };
        Button.prototype.dealloc = function () {
            this.el.removeEventListener("click", this.clickCallback, false);
            this.clickCallback = null;
            if (this.imageLoadedCallback) {
                this.imgEl.removeEventListener("load", this.imageLoadedCallback, false);
                this.imageLoadedCallback = null;
            }
            this.el.removeEventListener("mousedown", this.mouseDownCallback, false);
            this.mouseDownCallback = null;
            _super.prototype.dealloc.call(this);
        };
        // override
        Button.prototype.getTemplate = function () {
            return "<cf-button class=\"cf-button\">\n\t\t\t\t" + this.referenceTag.label + "\n\t\t\t</cf-button>\n\t\t\t";
        };
        return Button;
    }(cf.ControlElement));
    cf.Button = Button;
})(cf || (cf = {}));

/// <reference path="Button.ts"/>
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
// namespace
var cf;
(function (cf) {
    // interface
    // class
    var RadioButton = /** @class */ (function (_super) {
        __extends(RadioButton, _super);
        function RadioButton() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        Object.defineProperty(RadioButton.prototype, "type", {
            get: function () {
                return "RadioButton";
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(RadioButton.prototype, "checked", {
            get: function () {
                var _checked = this.el.hasAttribute("checked") && this.el.getAttribute("checked") == "checked";
                return _checked;
            },
            set: function (value) {
                if (!value) {
                    this.el.removeAttribute("checked");
                    this.referenceTag.domElement.removeAttribute("checked");
                    this.referenceTag.domElement.checked = false;
                }
                else {
                    this.el.setAttribute("checked", "checked");
                    this.referenceTag.domElement.setAttribute("checked", "checked");
                    this.referenceTag.domElement.checked = true;
                }
            },
            enumerable: true,
            configurable: true
        });
        RadioButton.prototype.onClick = function (event) {
            this.checked = true; // checked always true like native radio buttons
            _super.prototype.onClick.call(this, event);
        };
        // override
        RadioButton.prototype.getTemplate = function () {
            var isChecked = this.referenceTag.domElement.checked || this.referenceTag.domElement.hasAttribute("checked");
            return "<cf-radio-button class=\"cf-button\" " + (isChecked ? "checked=checked" : "") + ">\n\t\t\t\t<div>\n\t\t\t\t\t<cf-radio></cf-radio>\n\t\t\t\t\t<span>" + this.referenceTag.label + "</span>\n\t\t\t\t</div>\n\t\t\t</cf-radio-button>\n\t\t\t";
        };
        return RadioButton;
    }(cf.Button));
    cf.RadioButton = RadioButton;
})(cf || (cf = {}));

/// <reference path="Button.ts"/>
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
// namespace
var cf;
(function (cf) {
    // interface
    // class
    var CheckboxButton = /** @class */ (function (_super) {
        __extends(CheckboxButton, _super);
        function CheckboxButton() {
            return _super !== null && _super.apply(this, arguments) || this;
        }
        Object.defineProperty(CheckboxButton.prototype, "type", {
            get: function () {
                return "CheckboxButton";
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(CheckboxButton.prototype, "checked", {
            get: function () {
                return this.el.getAttribute("checked") == "checked";
            },
            set: function (value) {
                if (!value) {
                    this.el.removeAttribute("checked");
                    this.referenceTag.domElement.removeAttribute("checked");
                    this.referenceTag.domElement.checked = false;
                }
                else {
                    this.el.setAttribute("checked", "checked");
                    this.referenceTag.domElement.setAttribute("checked", "checked");
                    this.referenceTag.domElement.checked = true;
                }
            },
            enumerable: true,
            configurable: true
        });
        CheckboxButton.prototype.onClick = function (event) {
            this.checked = !this.checked;
        };
        // override
        CheckboxButton.prototype.getTemplate = function () {
            var isChecked = this.referenceTag.domElement.checked && this.referenceTag.domElement.hasAttribute("checked");
            return "<cf-button class=\"cf-button cf-checkbox-button " + (this.referenceTag.label.trim().length == 0 ? "no-text" : "") + "\" checked=" + (isChecked ? "checked" : "") + ">\n\t\t\t\t<div>\n\t\t\t\t\t<cf-checkbox></cf-checkbox>\n\t\t\t\t\t<span>" + this.referenceTag.label + "</span>\n\t\t\t\t</div>\n\t\t\t</cf-button>\n\t\t\t";
        };
        return CheckboxButton;
    }(cf.Button));
    cf.CheckboxButton = CheckboxButton;
})(cf || (cf = {}));

/// <reference path="Button.ts"/>
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
// namespace
var cf;
(function (cf) {
    // interface
    cf.OptionButtonEvents = {
        CLICK: "cf-option-button-click"
    };
    // class
    var OptionButton = /** @class */ (function (_super) {
        __extends(OptionButton, _super);
        function OptionButton() {
            var _this = _super !== null && _super.apply(this, arguments) || this;
            _this.isMultiChoice = false;
            return _this;
        }
        Object.defineProperty(OptionButton.prototype, "type", {
            get: function () {
                return "OptionButton";
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(OptionButton.prototype, "selected", {
            get: function () {
                return this.el.hasAttribute("selected");
            },
            set: function (value) {
                if (value) {
                    this.el.setAttribute("selected", "selected");
                }
                else {
                    this.el.removeAttribute("selected");
                }
            },
            enumerable: false,
            configurable: true
        });
        OptionButton.prototype.setData = function (options) {
            this.isMultiChoice = options.isMultiChoice;
            _super.prototype.setData.call(this, options);
        };
        OptionButton.prototype.onClick = function (event) {
            cf.ConversationalForm.illustrateFlow(this, "dispatch", cf.OptionButtonEvents.CLICK, this);
            this.eventTarget.dispatchEvent(new CustomEvent(cf.OptionButtonEvents.CLICK, {
                detail: this
            }));
        };
        // override
        OptionButton.prototype.getTemplate = function () {
            // be aware that first option element on none multiple select tags will be selected by default
            // Why: Check disableSelectPrefill config to control auto-selection behavior
            var isSelected = cf.ConversationalForm.disableSelectPrefill ? false : this.referenceTag.domElement.selected;
            var tmpl = '<cf-button class="cf-button ' + (this.isMultiChoice ? "cf-checkbox-button" : "") + '" ' + (isSelected ? "selected='selected'" : "") + '>';
            tmpl += "<div>";
            if (this.isMultiChoice)
                tmpl += "<cf-checkbox></cf-checkbox>";
            tmpl += this.referenceTag.label;
            tmpl += "</div>";
            tmpl += "</cf-button>";
            return tmpl;
        };
        return OptionButton;
    }(cf.Button));
    cf.OptionButton = OptionButton;
})(cf || (cf = {}));

/// <reference path="ControlElement.ts"/>
/// <reference path="OptionButton.ts"/>
// namespace
var cf;
(function (cf) {
    // interface
    // class
    // builds x OptionsButton from the registered SelectTag
    var OptionsList = /** @class */ (function () {
        function OptionsList(options) {
            this.context = options.context;
            this.eventTarget = options.eventTarget;
            this.referenceTag = options.referenceTag;
            // check for multi choice select tag
            this.multiChoice = this.referenceTag.domElement.hasAttribute("multiple");
            this.onOptionButtonClickCallback = this.onOptionButtonClick.bind(this);
            this.eventTarget.addEventListener(cf.OptionButtonEvents.CLICK, this.onOptionButtonClickCallback, false);
            this.createElements();
        }
        Object.defineProperty(OptionsList.prototype, "type", {
            get: function () {
                return "OptionsList";
            },
            enumerable: true,
            configurable: true
        });
        OptionsList.prototype.getValue = function () {
            var arr = [];
            for (var i = 0; i < this.elements.length; i++) {
                var element = this.elements[i];
                if (!this.multiChoice && element.selected) {
                    arr.push(element);
                    return arr;
                }
                else if (this.multiChoice && element.selected) {
                    arr.push(element);
                }
            }
            return arr;
        };
        OptionsList.prototype.onOptionButtonClick = function (event) {
            // if mutiple... then dont remove selection on other buttons
            if (!this.multiChoice) {
                // only one is selectable at the time.
                for (var i = 0; i < this.elements.length; i++) {
                    var element = this.elements[i];
                    if (element != event.detail) {
                        element.selected = false;
                    }
                    else {
                        element.selected = true;
                    }
                }
                cf.ConversationalForm.illustrateFlow(this, "dispatch", cf.ControlElementEvents.SUBMIT_VALUE, this.referenceTag);
                this.eventTarget.dispatchEvent(new CustomEvent(cf.ControlElementEvents.SUBMIT_VALUE, {
                    detail: event.detail
                }));
            }
            else {
                event.detail.selected = !event.detail.selected;
            }
        };
        OptionsList.prototype.createElements = function () {
            this.elements = [];
            var optionTags = this.referenceTag.optionTags;
            for (var i = 0; i < optionTags.length; i++) {
                var tag = optionTags[i];
                var btn = new cf.OptionButton({
                    referenceTag: tag,
                    isMultiChoice: this.referenceTag.multipleChoice,
                    eventTarget: this.eventTarget
                });
                this.elements.push(btn);
                this.context.appendChild(btn.el);
            }
        };
        OptionsList.prototype.dealloc = function () {
            this.eventTarget.removeEventListener(cf.OptionButtonEvents.CLICK, this.onOptionButtonClickCallback, false);
            this.onOptionButtonClickCallback = null;
            while (this.elements.length > 0)
                this.elements.pop().dealloc();
            this.elements = null;
        };
        return OptionsList;
    }());
    cf.OptionsList = OptionsList;
})(cf || (cf = {}));

/// <reference path="Button.ts"/>
/// <reference path="../../logic/Helpers.ts"/>
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
// namespace
var cf;
(function (cf) {
    // interface
    // class
    var UploadFileUI = /** @class */ (function (_super) {
        __extends(UploadFileUI, _super);
        function UploadFileUI(options) {
            var _this = _super.call(this, options) || this;
            _this.maxFileSize = 100000000000;
            _this.loading = false;
            _this.submitTimer = 0;
            _this._fileName = "";
            _this._readerResult = "";
            if (cf.Helpers.caniuse.fileReader()) {
                var maxFileSizeStr = _this.referenceTag.domElement.getAttribute("cf-max-size") || _this.referenceTag.domElement.getAttribute("max-size");
                if (maxFileSizeStr) {
                    var maxFileSize = parseInt(maxFileSizeStr, 10);
                    _this.maxFileSize = maxFileSize;
                }
                _this.progressBar = _this.el.getElementsByTagName("cf-upload-file-progress-bar")[0];
                _this.onDomElementChangeCallback = _this.onDomElementChange.bind(_this);
                _this.referenceTag.domElement.addEventListener("change", _this.onDomElementChangeCallback, false);
            }
            else {
                throw new Error("Conversational Form Error: No FileReader available for client.");
            }
            return _this;
        }
        Object.defineProperty(UploadFileUI.prototype, "value", {
            get: function () {
                return this.referenceTag.domElement.value; //;this.readerResult || this.fileName;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(UploadFileUI.prototype, "readerResult", {
            get: function () {
                return this._readerResult;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(UploadFileUI.prototype, "files", {
            get: function () {
                return this._files;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(UploadFileUI.prototype, "fileName", {
            get: function () {
                return this._fileName;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(UploadFileUI.prototype, "type", {
            get: function () {
                return "UploadFileUI";
            },
            enumerable: true,
            configurable: true
        });
        UploadFileUI.prototype.getFilesAsString = function () {
            // value is for the chat response -->
            var icon = document.createElement("span");
            icon.innerHTML = cf.Dictionary.get("icon-type-file") + this.fileName;
            return icon.outerHTML;
        };
        UploadFileUI.prototype.onDomElementChange = function (event) {
            var _this = this;
            if (!cf.ConversationalForm.suppressLog)
                console.log("...onDomElementChange");
            var reader = new FileReader();
            this._files = this.referenceTag.domElement.files;
            reader.onerror = function (event) {
                if (!cf.ConversationalForm.suppressLog)
                    console.log("onerror", event);
            };
            reader.onprogress = function (event) {
                if (!cf.ConversationalForm.suppressLog)
                    console.log("onprogress", event);
                _this.progressBar.style.width = ((event.loaded / event.total) * 100) + "%";
            };
            reader.onabort = function (event) {
                if (!cf.ConversationalForm.suppressLog)
                    console.log("onabort", event);
            };
            reader.onloadstart = function (event) {
                // check for file size
                var file = _this.files[0];
                var fileSize = file ? file.size : _this.maxFileSize + 1; // if file is undefined then abort ...
                if (fileSize > _this.maxFileSize) {
                    reader.abort();
                    var dto = {
                        errorText: cf.Dictionary.get("input-placeholder-file-size-error")
                    };
                    cf.ConversationalForm.illustrateFlow(_this, "dispatch", cf.FlowEvents.USER_INPUT_INVALID, dto);
                    _this.eventTarget.dispatchEvent(new CustomEvent(cf.FlowEvents.USER_INPUT_INVALID, {
                        detail: dto
                    }));
                }
                else {
                    // good to go
                    _this._fileName = file.name;
                    _this.loading = true;
                    _this.animateIn();
                    // set text
                    var sizeConversion = Math.floor(Math.log(fileSize) / Math.log(1024));
                    var sizeChart = ["b", "kb", "mb", "gb"];
                    sizeConversion = Math.min(sizeChart.length - 1, sizeConversion);
                    var humanSizeString = Number((fileSize / Math.pow(1024, sizeConversion)).toFixed(2)) * 1 + " " + sizeChart[sizeConversion];
                    var text = file.name + " (" + humanSizeString + ")";
                    _this.el.getElementsByTagName("cf-upload-file-text")[0].innerHTML = text;
                    _this.eventTarget.dispatchEvent(new CustomEvent(cf.ControlElementEvents.PROGRESS_CHANGE, {
                        detail: cf.ControlElementProgressStates.BUSY
                    }));
                }
            };
            reader.onload = function (event) {
                _this._readerResult = event.target.result;
                _this.progressBar.classList.add("loaded");
                _this.submitTimer = setTimeout(function () {
                    _this.el.classList.remove("animate-in");
                    _this.onChoose(); // submit the file
                    _this.eventTarget.dispatchEvent(new CustomEvent(cf.ControlElementEvents.PROGRESS_CHANGE, {
                        detail: cf.ControlElementProgressStates.READY
                    }));
                }, 0);
            };
            reader.readAsDataURL(this.files[0]);
        };
        UploadFileUI.prototype.animateIn = function () {
            if (this.loading)
                _super.prototype.animateIn.call(this);
        };
        UploadFileUI.prototype.onClick = function (event) {
            // super.onClick(event);
        };
        UploadFileUI.prototype.triggerFileSelect = function () {
            // trigger file prompt
            this.referenceTag.domElement.click();
        };
        // override
        UploadFileUI.prototype.dealloc = function () {
            clearTimeout(this.submitTimer);
            this.progressBar = null;
            if (this.onDomElementChangeCallback) {
                this.referenceTag.domElement.removeEventListener("change", this.onDomElementChangeCallback, false);
                this.onDomElementChangeCallback = null;
            }
            _super.prototype.dealloc.call(this);
        };
        UploadFileUI.prototype.getTemplate = function () {
            var isChecked = this.referenceTag.value == "1" || this.referenceTag.domElement.hasAttribute("checked");
            return "<cf-upload-file-ui>\n\t\t\t\t<cf-upload-file-text></cf-upload-file-text>\n\t\t\t\t<cf-upload-file-progress>\n\t\t\t\t\t<cf-upload-file-progress-bar></cf-upload-file-progress-bar>\n\t\t\t\t</cf-upload-file-progress>\n\t\t\t</cf-upload-file-ui>\n\t\t\t";
        };
        return UploadFileUI;
    }(cf.Button));
    cf.UploadFileUI = UploadFileUI;
})(cf || (cf = {}));

/// <reference path="../ui/BasicElement.ts"/>
/// <reference path="../ui//control-elements/ControlElements.ts"/>
/// <reference path="../logic/FlowManager.ts"/>
/// <reference path="../interfaces/IUserInputElement.ts"/>
/// <reference path="../ui/inputs/UserInputElement.ts"/>
/// <reference path="../interfaces/IUserInputElement.ts"/>
// namespace
var cf;
(function (cf) {
    cf.MicrophoneBridgeEvent = {
        ERROR: "cf-microphone-bridge-error",
        TERMNIAL_ERROR: "cf-microphone-bridge-terminal-error"
    };
    // class
    var MicrophoneBridge = /** @class */ (function () {
        function MicrophoneBridge(options) {
            this.currentTextResponse = "";
            this._hasUserMedia = false;
            this.inputErrorCount = 0;
            this.inputCurrentError = "";
            this.el = options.el;
            this.button = options.button;
            this.eventTarget = options.eventTarget;
            // data object
            this.microphoneObj = options.microphoneObj;
            this.flowUpdateCallback = this.onFlowUpdate.bind(this);
            this.eventTarget.addEventListener(cf.FlowEvents.FLOW_UPDATE, this.flowUpdateCallback, false);
        }
        Object.defineProperty(MicrophoneBridge.prototype, "hasUserMedia", {
            set: function (value) {
                this._hasUserMedia = value;
                if (!value) {
                    // this.submitButton.classList.add("permission-waiting");
                }
                else {
                    // this.submitButton.classList.remove("permission-waiting");
                }
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(MicrophoneBridge.prototype, "active", {
            set: function (value) {
                if (this.equalizer) {
                    this.equalizer.disabled = !value;
                }
            },
            enumerable: true,
            configurable: true
        });
        MicrophoneBridge.prototype.cancel = function () {
            this.button.loading = false;
            if (this.microphoneObj.cancelInput) {
                this.microphoneObj.cancelInput();
            }
        };
        MicrophoneBridge.prototype.onFlowUpdate = function () {
            var _this = this;
            this.currentTextResponse = null;
            if (!this._hasUserMedia) {
                // check if user has granted
                var hasGranted_1 = false;
                if (window.navigator.mediaDevices) {
                    window.navigator.mediaDevices.enumerateDevices().then(function (devices) {
                        devices.forEach(function (device) {
                            if (!hasGranted_1 && device.label !== "") {
                                hasGranted_1 = true;
                            }
                        });
                        if (hasGranted_1) {
                            // user has previously granted, so call getusermedia, as this wont prombt user
                            _this.getUserMedia();
                        }
                        else {
                            // await click on button, wait state
                        }
                    });
                }
            }
            else {
                // user has granted ready to go go
                if (!this.microphoneObj.awaitingCallback) {
                    this.callInput();
                }
            }
        };
        MicrophoneBridge.prototype.getUserMedia = function () {
            var _this = this;
            try {
                // from https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia#Using_the_new_API_in_older_browsers
                // Older browsers might not implement mediaDevices at all, so we set an empty object first
                if (navigator.mediaDevices === undefined) {
                    navigator.mediaDevices = {};
                }
                // Some browsers partially implement mediaDevices. We can't just assign an object
                // with getUserMedia as it would overwrite existing properties.
                // Here, we will just add the getUserMedia property if it's missing.
                if (navigator.mediaDevices.getUserMedia === undefined) {
                    navigator.mediaDevices.getUserMedia = function (constraints) {
                        // First get ahold of the legacy getUserMedia, if present
                        var getUserMedia = navigator.getUserMedia || window.navigator.webkitGetUserMedia || window.navigator.mozGetUserMedia;
                        // Some browsers just don't implement it - return a rejected promise with an error
                        // to keep a consistent interface
                        if (!getUserMedia) {
                            return Promise.reject(new Error('getUserMedia is not implemented in this browser'));
                        }
                        // Otherwise, wrap the call to the old navigator.getUserMedia with a Promise
                        return new Promise(function (resolve, reject) {
                            getUserMedia.call(navigator, constraints, resolve, reject);
                        });
                    };
                }
                navigator.mediaDevices.getUserMedia({ audio: true })
                    .then(function (stream) {
                    _this.currentStream = stream;
                    if (stream.getAudioTracks().length > 0) {
                        // interface is active and available, so call it immidiatly
                        _this.hasUserMedia = true;
                        _this.setupEqualizer();
                        if (!_this.microphoneObj.awaitingCallback) {
                            // microphone interface awaits speak out loud callback
                            _this.callInput();
                        }
                    }
                    else {
                        // code for when both devices are available
                        // interface is not active, button should be clicked
                        _this.hasUserMedia = false;
                    }
                })
                    .catch(function (error) {
                    // Promise catch
                    _this.hasUserMedia = false;
                    _this.eventTarget.dispatchEvent(new Event(cf.MicrophoneBridgeEvent.TERMNIAL_ERROR));
                });
            }
            catch (error) {
                // try catch
                // whoops no getUserMedia, so roll back to standard UI
                this.hasUserMedia = false;
                this.eventTarget.dispatchEvent(new Event(cf.MicrophoneBridgeEvent.TERMNIAL_ERROR));
            }
        };
        MicrophoneBridge.prototype.dealloc = function () {
            this.cancel();
            this.promise = null;
            this.currentStream = null;
            if (this.equalizer) {
                this.equalizer.dealloc();
            }
            this.equalizer = null;
            this.eventTarget.removeEventListener(cf.FlowEvents.FLOW_UPDATE, this.flowUpdateCallback, false);
            this.flowUpdateCallback = null;
        };
        MicrophoneBridge.prototype.callInput = function (messageTime) {
            // remove current error message after x time
            // clearTimeout(this.clearMessageTimer);
            // this.clearMessageTimer = setTimeout(() =>{
            // 	this.el.removeAttribute("message");
            // }, messageTime);
            var _this = this;
            if (messageTime === void 0) { messageTime = 0; }
            this.button.loading = true;
            if (this.equalizer) {
                this.equalizer.disabled = false;
            }
            // call API, SpeechRecognintion etc. you decide, passing along the stream from getUserMedia can be used.. as long as the resolve is called with string attribute
            this.promise = new Promise(function (resolve, reject) { return _this.microphoneObj.input(resolve, reject, _this.currentStream); })
                .then(function (result) {
                // api contacted
                _this.promise = null;
                // save response so it's available in getFlowDTO
                _this.currentTextResponse = result.toString();
                if (!_this.currentTextResponse || _this.currentTextResponse == "") {
                    _this.showError(cf.Dictionary.get("user-audio-reponse-invalid"));
                    // invalid input, so call API again
                    _this.callInput();
                    return;
                }
                _this.inputErrorCount = 0;
                _this.inputCurrentError = "";
                _this.button.loading = false;
                // continue flow
                var dto = {
                    text: _this.currentTextResponse
                };
                cf.ConversationalForm.illustrateFlow(_this, "dispatch", cf.UserInputEvents.SUBMIT, dto);
                _this.eventTarget.dispatchEvent(new CustomEvent(cf.UserInputEvents.SUBMIT, {
                    detail: dto
                }));
            }).catch(function (error) {
                // API error
                // ConversationalForm.illustrateFlow(this, "dispatch", MicrophoneBridgeEvent.ERROR, error);
                // this.eventTarget.dispatchEvent(new CustomEvent(MicrophoneBridgeEvent.ERROR, {
                // 	detail: error
                // }));
                if (_this.isErrorTerminal(error)) {
                    // terminal error, fallback to 
                    _this.eventTarget.dispatchEvent(new CustomEvent(cf.MicrophoneBridgeEvent.TERMNIAL_ERROR, {
                        detail: cf.Dictionary.get("microphone-terminal-error")
                    }));
                    if (!cf.ConversationalForm.suppressLog)
                        console.log("Conversational Form: Terminal error: ", error);
                }
                else {
                    if (_this.inputCurrentError != error) {
                        // api failed ...
                        // show result in UI
                        _this.inputErrorCount = 0;
                        _this.inputCurrentError = error;
                    }
                    else {
                    }
                    _this.inputErrorCount++;
                    if (_this.inputErrorCount > 2) {
                        _this.showError(error);
                    }
                    else {
                        _this.eventTarget.dispatchEvent(new CustomEvent(cf.MicrophoneBridgeEvent.TERMNIAL_ERROR, {
                            detail: cf.Dictionary.get("microphone-terminal-error")
                        }));
                        if (!cf.ConversationalForm.suppressLog)
                            console.log("Conversational Form: Terminal error: ", error);
                    }
                }
            });
        };
        MicrophoneBridge.prototype.isErrorTerminal = function (error) {
            var terminalErrors = ["network"];
            if (terminalErrors.indexOf(error) !== -1)
                return true;
            return false;
        };
        MicrophoneBridge.prototype.showError = function (error) {
            var dto = {
                errorText: error
            };
            cf.ConversationalForm.illustrateFlow(this, "dispatch", cf.FlowEvents.USER_INPUT_INVALID, dto);
            this.eventTarget.dispatchEvent(new CustomEvent(cf.FlowEvents.USER_INPUT_INVALID, {
                detail: dto
            }));
            this.callInput();
        };
        MicrophoneBridge.prototype.setupEqualizer = function () {
            var eqEl = this.el.getElementsByTagName("cf-icon-audio-eq")[0];
            if (SimpleEqualizer.supported && eqEl) {
                this.equalizer = new SimpleEqualizer({
                    stream: this.currentStream,
                    elementToScale: eqEl
                });
            }
        };
        return MicrophoneBridge;
    }());
    cf.MicrophoneBridge = MicrophoneBridge;
    var SimpleEqualizer = /** @class */ (function () {
        function SimpleEqualizer(options) {
            var _this = this;
            this.maxBorderWidth = 0;
            this._disabled = false;
            this.elementToScale = options.elementToScale;
            this.context = new AudioContext();
            this.analyser = this.context.createAnalyser();
            this.mic = this.context.createMediaStreamSource(options.stream);
            this.javascriptNode = this.context.createScriptProcessor(2048, 1, 1);
            this.analyser.smoothingTimeConstant = 0.3;
            this.analyser.fftSize = 1024;
            this.mic.connect(this.analyser);
            this.analyser.connect(this.javascriptNode);
            this.javascriptNode.connect(this.context.destination);
            this.javascriptNode.onaudioprocess = function () {
                _this.onAudioProcess();
            };
        }
        Object.defineProperty(SimpleEqualizer.prototype, "disabled", {
            set: function (value) {
                this._disabled = value;
                this.elementToScale.style.borderWidth = 0 + "px";
            },
            enumerable: true,
            configurable: true
        });
        SimpleEqualizer.prototype.onAudioProcess = function () {
            if (this._disabled)
                return;
            var array = new Uint8Array(this.analyser.frequencyBinCount);
            this.analyser.getByteFrequencyData(array);
            var values = 0;
            var length = array.length;
            for (var i = 0; i < length; i++) {
                values += array[i];
            }
            var average = values / length;
            var percent = Math.min(1, Math.max(0, 1 - ((50 - average) / 50)));
            if (!this.maxBorderWidth) {
                this.maxBorderWidth = this.elementToScale.offsetWidth * 0.5;
            }
            this.elementToScale.style.borderWidth = (this.maxBorderWidth * percent) + "px";
        };
        SimpleEqualizer.prototype.dealloc = function () {
            this.javascriptNode.onaudioprocess = null;
            this.javascriptNode = null;
            this.analyser = null;
            this.mic = null;
            this.elementToScale = null;
            this.context = null;
        };
        SimpleEqualizer.supported = function () {
            window.AudioContext = window.AudioContext || window.webkitAudioContext;
            if (window.AudioContext) {
                return true;
            }
            else {
                return false;
            }
        };
        return SimpleEqualizer;
    }());
})(cf || (cf = {}));

/// <reference path="../BasicElement.ts"/>
/// <reference path="../control-elements/ControlElements.ts"/>
/// <reference path="../../logic/FlowManager.ts"/>
/// <reference path="../../logic/MicrophoneBridge.ts"/>
/// <reference path="../../interfaces/IUserInputElement.ts"/>
/// <reference path="UserInputElement.ts"/>
// namespace
var cf;
(function (cf) {
    // interface
    cf.UserInputSubmitButtonEvents = {
        CHANGE: "userinput-submit-button-change-value"
    };
    // class
    var UserInputSubmitButton = /** @class */ (function () {
        function UserInputSubmitButton(options) {
            this._active = true;
            this.eventTarget = options.eventTarget;
            var template = document.createElement('template');
            template.innerHTML = this.getTemplate();
            this.el = template.firstChild || template.content.firstChild;
            this.onClickCallback = this.onClick.bind(this);
            this.el.addEventListener("click", this.onClickCallback, false);
            this.onMicrophoneTerminalErrorCallback = this.onMicrophoneTerminalError.bind(this);
            this.eventTarget.addEventListener(cf.MicrophoneBridgeEvent.TERMNIAL_ERROR, this.onMicrophoneTerminalErrorCallback, false);
        }
        Object.defineProperty(UserInputSubmitButton.prototype, "typing", {
            get: function () {
                return this.el.classList.contains("typing");
            },
            set: function (value) {
                if (value) {
                    this.el.classList.add("typing");
                    this.loading = false;
                    if (this.mic) {
                        this.mic.cancel();
                    }
                }
                else {
                    this.el.classList.remove("typing");
                    if (this.mic) {
                        this.mic.callInput();
                    }
                }
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(UserInputSubmitButton.prototype, "active", {
            get: function () {
                return this._active;
            },
            set: function (value) {
                this._active = value;
                if (this.mic) {
                    this.mic.active = value;
                }
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(UserInputSubmitButton.prototype, "loading", {
            get: function () {
                return this.el.classList.contains("loading");
            },
            set: function (value) {
                if (value)
                    this.el.classList.add("loading");
                else
                    this.el.classList.remove("loading");
            },
            enumerable: true,
            configurable: true
        });
        UserInputSubmitButton.prototype.addMicrophone = function (microphoneObj) {
            this.el.classList.add("microphone-interface");
            var template = document.createElement('template');
            template.innerHTML = "<div class=\"cf-input-icons cf-microphone\">\n\t\t\t\t<div class=\"cf-icon-audio\"></div>\n\t\t\t\t<cf-icon-audio-eq></cf-icon-audio-eq>\n\t\t\t</div>";
            var mic = template.firstChild || template.content.firstChild;
            this.mic = new cf.MicrophoneBridge({
                el: mic,
                button: this,
                eventTarget: this.eventTarget,
                microphoneObj: microphoneObj
            });
            this.el.appendChild(mic);
            // this.mic = null;
            // this.el.appendChild(this.mic.el);
        };
        UserInputSubmitButton.prototype.reset = function () {
            if (this.mic && !this.typing) {
                // if microphone and not typing
                this.mic.callInput();
            }
        };
        UserInputSubmitButton.prototype.getTemplate = function () {
            return "<cf-input-button class=\"cf-input-button\">\n\t\t\t\t\t\t<div class=\"cf-input-icons\">\n\t\t\t\t\t\t\t<div class=\"cf-icon-progress\"></div>\n\t\t\t\t\t\t\t<div class=\"cf-icon-attachment\"></div>\n\t\t\t\t\t\t</div>\n\t\t\t\t\t</cf-input-button>";
        };
        UserInputSubmitButton.prototype.onMicrophoneTerminalError = function (event) {
            if (this.mic) {
                this.mic.dealloc();
                this.mic = null;
                this.el.removeChild(this.el.getElementsByClassName("cf-microphone")[0]);
                this.el.classList.remove("microphone-interface");
                this.loading = false;
                this.eventTarget.dispatchEvent(new CustomEvent(cf.FlowEvents.USER_INPUT_INVALID, {
                    detail: {
                        errorText: event.detail
                    } //UserTextInput value
                }));
            }
        };
        UserInputSubmitButton.prototype.onClick = function (event) {
            var isMicVisible = this.mic && !this.typing;
            if (isMicVisible) {
                this.mic.callInput();
            }
            else {
                this.eventTarget.dispatchEvent(new CustomEvent(cf.UserInputSubmitButtonEvents.CHANGE));
            }
        };
        /**
        * @name click
        * force click on button
        */
        UserInputSubmitButton.prototype.click = function () {
            this.el.click();
        };
        /**
        * @name dealloc
        * remove instance
        */
        UserInputSubmitButton.prototype.dealloc = function () {
            this.eventTarget.removeEventListener(cf.MicrophoneBridgeEvent.TERMNIAL_ERROR, this.onMicrophoneTerminalErrorCallback, false);
            this.onMicrophoneTerminalErrorCallback = null;
            if (this.mic) {
                this.mic.dealloc();
            }
            this.mic = null;
            this.el.removeEventListener("click", this.onClickCallback, false);
            this.onClickCallback = null;
            this.el = null;
            this.eventTarget = null;
        };
        return UserInputSubmitButton;
    }());
    cf.UserInputSubmitButton = UserInputSubmitButton;
})(cf || (cf = {}));

/// <reference path="../logic/FlowManager.ts"/>
// namespace
var cf;
(function (cf) {
    // interface
    cf.UserInputTypes = {
        VOICE: "voice",
        VR_GESTURE: "vr-gesture",
        TEXT: "text" // <-- default
    };
})(cf || (cf = {}));


/// <reference path="../BasicElement.ts"/>
/// <reference path="../control-elements/ControlElements.ts"/>
/// <reference path="../../logic/FlowManager.ts"/>
/// <reference path="../../interfaces/IUserInput.ts"/>
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
// Abstract UserInpt element, should be extended when adding a new UI for user input
// namespace
var cf;
(function (cf) {
    // interface
    var UserInputElement = /** @class */ (function (_super) {
        __extends(UserInputElement, _super);
        function UserInputElement(options) {
            var _this = _super.call(this, options) || this;
            _this._disabled = false;
            _this._visible = false;
            _this.onChatReponsesUpdatedCallback = _this.onChatReponsesUpdated.bind(_this);
            _this.eventTarget.addEventListener(cf.ChatListEvents.CHATLIST_UPDATED, _this.onChatReponsesUpdatedCallback, false);
            _this.windowFocusCallback = _this.windowFocus.bind(_this);
            window.addEventListener('focus', _this.windowFocusCallback, false);
            _this.inputInvalidCallback = _this.inputInvalid.bind(_this);
            _this.eventTarget.addEventListener(cf.FlowEvents.USER_INPUT_INVALID, _this.inputInvalidCallback, false);
            _this.flowUpdateCallback = _this.onFlowUpdate.bind(_this);
            _this.eventTarget.addEventListener(cf.FlowEvents.FLOW_UPDATE, _this.flowUpdateCallback, false);
            return _this;
        }
        Object.defineProperty(UserInputElement.prototype, "currentTag", {
            get: function () {
                return this._currentTag;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(UserInputElement.prototype, "visible", {
            set: function (value) {
                var _this = this;
                this._visible = value;
                if (!this.el.classList.contains("animate-in") && value) {
                    setTimeout(function () {
                        _this.el.classList.add("animate-in");
                    }, 0);
                }
                else if (this.el.classList.contains("animate-in") && !value) {
                    this.el.classList.remove("animate-in");
                }
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(UserInputElement.prototype, "disabled", {
            get: function () {
                return this._disabled;
            },
            set: function (value) {
                var hasChanged = this._disabled != value;
                if (hasChanged) {
                    this._disabled = value;
                    if (value) {
                        this.el.setAttribute("disabled", "disabled");
                    }
                    else {
                        this.setFocusOnInput();
                        this.el.removeAttribute("disabled");
                    }
                }
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(UserInputElement.prototype, "height", {
            get: function () {
                var elHeight = 0;
                var elMargin = 0;
                var el = this.el;
                if (cf.Helpers.isInternetExlorer()) {
                    // IE
                    elHeight = el.offsetHeight;
                    elMargin = parseInt(el.currentStyle.marginTop, 10) + parseInt(el.currentStyle.marginBottom, 10);
                    elMargin *= 2;
                }
                else {
                    // none-IE
                    elHeight = parseInt(document.defaultView.getComputedStyle(el, '').getPropertyValue('height'), 10);
                    elMargin = parseInt(document.defaultView.getComputedStyle(el, '').getPropertyValue('margin-top')) + parseInt(document.defaultView.getComputedStyle(el, '').getPropertyValue('margin-bottom'));
                }
                return (elHeight + elMargin);
            },
            enumerable: true,
            configurable: true
        });
        UserInputElement.prototype.onEnterOrSubmitButtonSubmit = function (event) {
            if (event === void 0) { event = null; }
        };
        UserInputElement.prototype.inputInvalid = function (event) {
        };
        /**
        * @name deactivate
        * DEactivate the field
        */
        UserInputElement.prototype.deactivate = function () {
            this.disabled = true;
        };
        /**
        * @name reactivate
        * REactivate the field
        */
        UserInputElement.prototype.reactivate = function () {
            this.disabled = false;
        };
        UserInputElement.prototype.getFlowDTO = function () {
            var value; // = this.inputElement.value;
            return value;
        };
        UserInputElement.prototype.setFocusOnInput = function () {
        };
        UserInputElement.prototype.onFlowStopped = function () {
        };
        UserInputElement.prototype.reset = function () {
        };
        UserInputElement.prototype.dealloc = function () {
            this.eventTarget.removeEventListener(cf.ChatListEvents.CHATLIST_UPDATED, this.onChatReponsesUpdatedCallback, false);
            this.onChatReponsesUpdatedCallback = null;
            this.eventTarget.removeEventListener(cf.FlowEvents.USER_INPUT_INVALID, this.inputInvalidCallback, false);
            this.inputInvalidCallback = null;
            window.removeEventListener('focus', this.windowFocusCallback, false);
            this.windowFocusCallback = null;
            this.eventTarget.removeEventListener(cf.FlowEvents.FLOW_UPDATE, this.flowUpdateCallback, false);
            this.flowUpdateCallback = null;
            _super.prototype.dealloc.call(this);
        };
        UserInputElement.prototype.onFlowUpdate = function (event) {
            cf.ConversationalForm.illustrateFlow(this, "receive", event.type, event.detail);
            this._currentTag = event.detail.tag;
        };
        UserInputElement.prototype.windowFocus = function (event) {
        };
        UserInputElement.prototype.onChatReponsesUpdated = function (event) {
            // only show when user response
            if (!event.detail.currentResponse.isRobotResponse) {
                this.visible = true;
                this.disabled = false;
                this.setFocusOnInput();
            }
        };
        UserInputElement.ERROR_TIME = 2000;
        UserInputElement.preventAutoFocus = false;
        UserInputElement.hideUserInputOnNoneTextInput = false;
        return UserInputElement;
    }(cf.BasicElement));
    cf.UserInputElement = UserInputElement;
    cf.UserInputEvents = {
        SUBMIT: "cf-input-user-input-submit",
        KEY_CHANGE: "cf-input-key-change",
        CONTROL_ELEMENTS_ADDED: "cf-input-control-elements-added",
        HEIGHT_CHANGE: "cf-input-height-change",
        FOCUS: "cf-input-focus",
        BLUR: "cf-input-blur",
    };
})(cf || (cf = {}));

/// <reference path="../BasicElement.ts"/>
/// <reference path="../control-elements/ControlElements.ts"/>
/// <reference path="../../logic/FlowManager.ts"/>
/// <reference path="../../interfaces/IUserInputElement.ts"/>
/// <reference path="UserInputElement.ts"/>
/// <reference path="UserInputSubmitButton.ts"/>
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (Object.prototype.hasOwnProperty.call(b, p)) d[p] = b[p]; };
        return extendStatics(d, b);
    };
    return function (d, b) {
        if (typeof b !== "function" && b !== null)
            throw new TypeError("Class extends value " + String(b) + " is not a constructor or null");
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
// namespace
var cf;
(function (cf) {
    // interface
    // class
    var UserTextInput = /** @class */ (function (_super) {
        __extends(UserTextInput, _super);
        function UserTextInput(options) {
            var _this = _super.call(this, options) || this;
            _this.initialInputHeight = 0;
            _this.shiftIsDown = false;
            //acts as a fallback for ex. shadow dom implementation
            _this._active = false;
            _this.cfReference = options.cfReference;
            _this.eventTarget = options.eventTarget;
            _this.inputElement = _this.el.getElementsByTagName("textarea")[0];
            _this.onInputFocusCallback = _this.onInputFocus.bind(_this);
            _this.onInputBlurCallback = _this.onInputBlur.bind(_this);
            _this.inputElement.addEventListener('focus', _this.onInputFocusCallback, false);
            _this.inputElement.addEventListener('blur', _this.onInputBlurCallback, false);
            if (!cf.ConversationalForm.animationsEnabled) {
                _this.inputElement.setAttribute('no-animations', '');
            }
            //<cf-input-control-elements> is defined in the ChatList.ts
            _this.controlElements = new cf.ControlElements({
                el: _this.el.getElementsByTagName("cf-input-control-elements")[0],
                cfReference: _this.cfReference,
                infoEl: _this.el.getElementsByTagName("cf-info")[0],
                eventTarget: _this.eventTarget
            });
            // setup event listeners
            _this.keyUpCallback = _this.onKeyUp.bind(_this);
            document.addEventListener("keyup", _this.keyUpCallback, false);
            _this.keyDownCallback = _this.onKeyDown.bind(_this);
            document.addEventListener("keydown", _this.keyDownCallback, false);
            _this.onOriginalTagChangedCallback = _this.onOriginalTagChanged.bind(_this);
            _this.eventTarget.addEventListener(cf.TagEvents.ORIGINAL_ELEMENT_CHANGED, _this.onOriginalTagChangedCallback, false);
            _this.onControlElementSubmitCallback = _this.onControlElementSubmit.bind(_this);
            _this.eventTarget.addEventListener(cf.ControlElementEvents.SUBMIT_VALUE, _this.onControlElementSubmitCallback, false);
            _this.onControlElementProgressChangeCallback = _this.onControlElementProgressChange.bind(_this);
            _this.eventTarget.addEventListener(cf.ControlElementEvents.PROGRESS_CHANGE, _this.onControlElementProgressChangeCallback, false);
            _this.onSubmitButtonChangeStateCallback = _this.onSubmitButtonChangeState.bind(_this);
            _this.eventTarget.addEventListener(cf.UserInputSubmitButtonEvents.CHANGE, _this.onSubmitButtonChangeStateCallback, false);
            // this.eventTarget.addEventListener(ControlElementsEvents.ON_RESIZE, () => {}, false);
            _this.submitButton = new cf.UserInputSubmitButton({
                eventTarget: _this.eventTarget
            });
            _this.el.querySelector('div').appendChild(_this.submitButton.el);
            // setup microphone support, audio
            if (options.microphoneInputObj) {
                _this.microphoneObj = options.microphoneInputObj;
                if (_this.microphoneObj && _this.microphoneObj.init) {
                    // init if init method is defined
                    _this.microphoneObj.init();
                }
                _this.submitButton.addMicrophone(_this.microphoneObj);
            }
            return _this;
        }
        Object.defineProperty(UserTextInput.prototype, "active", {
            get: function () {
                return this.inputElement === document.activeElement || this._active;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(UserTextInput.prototype, "disabled", {
            set: function (value) {
                var hasChanged = this._disabled != value;
                if (!cf.ConversationalForm.suppressLog)
                    console.log('option hasChanged', value);
                if (hasChanged) {
                    this._disabled = value;
                    if (value) {
                        this.el.setAttribute("disabled", "disabled");
                        this.inputElement.blur();
                    }
                    else {
                        this.setFocusOnInput();
                        this.el.removeAttribute("disabled");
                    }
                }
            },
            enumerable: false,
            configurable: true
        });
        UserTextInput.prototype.getInputValue = function () {
            // Why: Trim leading spaces to prevent empty input with only spaces
            // How: Use regex replace for ES5 compatibility (trimStart requires ES2019)
            var str = this.inputElement.value.replace(/^\s+/, '');
            // Build-in way to handle XSS issues ->
            var div = document.createElement('div');
            div.appendChild(document.createTextNode(str));
            return div.innerHTML;
        };
        UserTextInput.prototype.getFlowDTO = function () {
            var value; // = this.inputElement.value;
            // check for values on control elements as they should overwrite the input value.
            if (this.controlElements && this.controlElements.active) {
                value = this.controlElements.getDTO();
            }
            else {
                value = {
                    text: this.getInputValue()
                };
            }
            // add current tag to DTO if not set
            if (!value.tag)
                value.tag = this.currentTag;
            value.input = this;
            value.tag = this.currentTag;
            return value;
        };
        UserTextInput.prototype.reset = function () {
            if (this.controlElements) {
                this.controlElements.clearTagsAndReset();
            }
        };
        UserTextInput.prototype.deactivate = function () {
            _super.prototype.deactivate.call(this);
            if (this.microphoneObj) {
                this.submitButton.active = false;
            }
        };
        UserTextInput.prototype.reactivate = function () {
            _super.prototype.reactivate.call(this);
            // called from microphone interface, check if active microphone, and set loading if yes
            if (this.microphoneObj && !this.submitButton.typing) {
                this.submitButton.loading = true;
                // setting typing to false calls the externa interface, like Microphone
                this.submitButton.typing = false;
                this.submitButton.active = true;
            }
        };
        UserTextInput.prototype.onFlowStopped = function () {
            this.submitButton.loading = false;
            if (this.submitButton.typing)
                this.submitButton.typing = false;
            if (this.controlElements)
                this.controlElements.clearTagsAndReset();
            this.disabled = true;
        };
        /**
        * @name onOriginalTagChanged
        * on domElement from a Tag value changed..
        */
        UserTextInput.prototype.onOriginalTagChanged = function (event) {
            if (this.currentTag == event.detail.tag) {
                this.onInputChange();
            }
            if (this.controlElements && this.controlElements.active) {
                this.controlElements.updateStateOnElementsFromTag(event.detail.tag);
            }
        };
        UserTextInput.prototype.onInputChange = function () {
            if (!this.active && !this.controlElements.active)
                return;
            // safari likes to jump around with the scrollHeight value, let's keep it in check with an initial height.
            var oldHeight = Math.max(this.initialInputHeight, parseInt(this.inputElement.style.height, 10));
            this.inputElement.style.height = '0px';
            // console.log(this.inputElement.style.height, this.inputElement.style);
            this.inputElement.style.height = (this.inputElement.scrollHeight === 0 ? oldHeight : this.inputElement.scrollHeight) + "px";
            cf.ConversationalForm.illustrateFlow(this, "dispatch", cf.UserInputEvents.HEIGHT_CHANGE);
            this.eventTarget.dispatchEvent(new CustomEvent(cf.UserInputEvents.HEIGHT_CHANGE, {
                detail: this.inputElement.scrollHeight
            }));
        };
        UserTextInput.prototype.resetInputHeight = function () {
            if (this.inputElement.getAttribute('rows') === '1') {
                this.inputElement.style.height = this.initialInputHeight + 'px';
            }
            else {
                this.inputElement.style.height = '0px';
            }
        };
        UserTextInput.prototype.inputInvalid = function (event) {
            var _this = this;
            cf.ConversationalForm.illustrateFlow(this, "receive", event.type, event.detail);
            var dto = event.detail;
            this.inputElement.setAttribute("data-value", this.inputElement.value);
            this.inputElement.value = "";
            this.el.setAttribute("error", "");
            this.disabled = true;
            // cf-error
            this.inputElement.setAttribute("placeholder", dto.errorText || (this._currentTag ? this._currentTag.errorMessage : ""));
            clearTimeout(this.errorTimer);
            // remove loading class
            this.submitButton.loading = false;
            this.errorTimer = setTimeout(function () {
                _this.disabled = false;
                if (!cf.ConversationalForm.suppressLog)
                    console.log('option, disabled 1');
                _this.el.removeAttribute("error");
                _this.inputElement.value = _this.inputElement.getAttribute("data-value");
                _this.inputElement.setAttribute("data-value", "");
                _this.setPlaceholder();
                _this.setFocusOnInput();
                //TODO: reset submit button..
                _this.submitButton.reset();
                if (_this.controlElements)
                    _this.controlElements.resetAfterErrorMessage();
            }, cf.UserInputElement.ERROR_TIME);
        };
        UserTextInput.prototype.setPlaceholder = function () {
            if (this._currentTag) {
                if (this._currentTag.inputPlaceholder) {
                    this.inputElement.setAttribute("placeholder", this._currentTag.inputPlaceholder);
                }
                else {
                    this.inputElement.setAttribute("placeholder", this._currentTag.type == "group" ? cf.Dictionary.get("group-placeholder") : cf.Dictionary.get("input-placeholder"));
                }
            }
            else {
                this.inputElement.setAttribute("placeholder", cf.Dictionary.get("group-placeholder"));
            }
        };
        /**
         * TODO: handle detect input/textarea in a simpler way - too conditional heavy
         *
         * @private
         * @memberof UserTextInput
         */
        UserTextInput.prototype.checkForCorrectInputTag = function () {
            var tagName = this.tagType(this._currentTag);
            // remove focus and blur events, because we want to create a new element
            if (this.inputElement && this.inputElement.tagName !== tagName) {
                this.inputElement.removeEventListener('focus', this.onInputFocusCallback, false);
                this.inputElement.removeEventListener('blur', this.onInputBlurCallback, false);
            }
            this.removeAttribute('autocomplete');
            this.removeAttribute('list');
            if (tagName === 'INPUT') {
                // change to input
                var input_1 = document.createElement("input");
                Array.prototype.slice.call(this.inputElement.attributes).forEach(function (item) {
                    input_1.setAttribute(item.name, item.value);
                });
                if (this.inputElement.type === 'password') {
                    input_1.setAttribute("autocomplete", "new-password");
                }
                if (this._currentTag.domElement.hasAttribute('autocomplete')) {
                    input_1.setAttribute('autocomplete', this._currentTag.domElement.getAttribute('autocomplete'));
                }
                if (this._currentTag.domElement.hasAttribute('list')) {
                    input_1.setAttribute('list', this._currentTag.domElement.getAttribute('list'));
                }
                this.inputElement.parentNode.replaceChild(input_1, this.inputElement);
                this.inputElement = input_1;
            }
            else if (this.inputElement && this.inputElement.tagName !== tagName) {
                // change to textarea
                var textarea_1 = document.createElement("textarea");
                Array.prototype.slice.call(this.inputElement.attributes).forEach(function (item) {
                    textarea_1.setAttribute(item.name, item.value);
                });
                this.inputElement.parentNode.replaceChild(textarea_1, this.inputElement);
                this.inputElement = textarea_1;
            }
            // add focus and blur events to newly created input element
            if (this.inputElement && this.inputElement.tagName !== tagName) {
                this.inputElement.addEventListener('focus', this.onInputFocusCallback, false);
                this.inputElement.addEventListener('blur', this.onInputBlurCallback, false);
            }
            if (this.initialInputHeight == 0) {
                // initial height not set
                this.initialInputHeight = this.inputElement.offsetHeight;
            }
            this.setFocusOnInput();
        };
        /**
         * Removes attribute on input element if attribute is present
         *
         * @private
         * @param {string} attribute
         * @memberof UserTextInput
         */
        UserTextInput.prototype.removeAttribute = function (attribute) {
            if (this.inputElement
                && this.inputElement.hasAttribute(attribute)) {
                this.inputElement.removeAttribute(attribute);
            }
        };
        UserTextInput.prototype.tagType = function (inputElement) {
            if (!inputElement.domElement
                || !inputElement.domElement.tagName) {
                return 'TEXTAREA';
            }
            if (inputElement.domElement.tagName === 'TEXTAREA'
                || (inputElement.domElement.hasAttribute('rows')
                    && parseInt(inputElement.domElement.getAttribute('rows'), 10) > 1))
                return 'TEXTAREA';
            if (inputElement.domElement.tagName === 'INPUT')
                return 'INPUT';
            return 'TEXTAREA'; // TODO
        };
        UserTextInput.prototype.onFlowUpdate = function (event) {
            var _this = this;
            _super.prototype.onFlowUpdate.call(this, event);
            this.submitButton.loading = false;
            if (this.submitButton.typing)
                this.submitButton.typing = false;
            // animate input field in
            this.el.setAttribute("tag-type", this._currentTag.type);
            // replace textarea and visa versa
            this.checkForCorrectInputTag();
            // set input field to type password if the dom input field is that, covering up the input
            var isInputSpecificType = ["password", "number", "email", "tel"].indexOf(this._currentTag.type) !== -1;
            this.inputElement.setAttribute("type", isInputSpecificType ? this._currentTag.type : "input");
            clearTimeout(this.errorTimer);
            this.el.removeAttribute("error");
            this.inputElement.setAttribute("data-value", "");
            this.inputElement.value = "";
            this.submitButton.loading = false;
            this.setPlaceholder();
            this.resetValue();
            this.setFocusOnInput();
            this.controlElements.reset();
            if (this._currentTag.type == "group") {
                this.buildControlElements(this._currentTag.elements);
            }
            else {
                this.buildControlElements([this._currentTag]);
            }
            if (this._currentTag.defaultValue) {
                this.inputElement.value = this._currentTag.defaultValue.toString();
            }
            if (this._currentTag.skipUserInput === true) {
                this.el.classList.add("hide-input");
            }
            else {
                this.el.classList.remove("hide-input");
            }
            // Set rows attribute if present
            if (this._currentTag.rows && this._currentTag.rows > 1) {
                this.inputElement.setAttribute('rows', this._currentTag.rows.toString());
            }
            if (cf.UserInputElement.hideUserInputOnNoneTextInput) {
                // toggle userinput hide
                if (this.controlElements.active) {
                    this.el.classList.add("hide-input");
                    // set focus on first control element
                    this.controlElements.focusFrom("bottom");
                }
                else {
                    this.el.classList.remove("hide-input");
                }
            }
            this.resetInputHeight();
            setTimeout(function () {
                _this.onInputChange();
            }, 300);
        };
        UserTextInput.prototype.onControlElementProgressChange = function (event) {
            var status = event.detail;
            this.disabled = status == cf.ControlElementProgressStates.BUSY;
            if (!cf.ConversationalForm.suppressLog)
                console.log('option, disabled 2');
        };
        UserTextInput.prototype.buildControlElements = function (tags) {
            this.controlElements.buildTags(tags);
        };
        UserTextInput.prototype.onControlElementSubmit = function (event) {
            cf.ConversationalForm.illustrateFlow(this, "receive", event.type, event.detail);
            // when ex a RadioButton is clicked..
            var controlElement = event.detail;
            this.controlElements.updateStateOnElements(controlElement);
            this.doSubmit();
        };
        UserTextInput.prototype.onSubmitButtonChangeState = function (event) {
            this.onEnterOrSubmitButtonSubmit(event);
        };
        UserTextInput.prototype.isMetaKeyPressed = function (event) {
            // if any meta keys, then ignore, getModifierState, but safari does not support..
            if (event.metaKey || [91, 93].indexOf(event.keyCode) !== -1)
                return;
        };
        UserTextInput.prototype.onKeyDown = function (event) {
            if (!this.active && !this.controlElements.focus)
                return;
            if (this.isControlElementsActiveAndUserInputHidden())
                return;
            if (this.isMetaKeyPressed(event))
                return;
            // if any meta keys, then ignore
            if (event.keyCode == cf.Dictionary.keyCodes["shift"])
                this.shiftIsDown = true;
            // If submit is prevented by option 'preventSubmitOnEnter'
            if (this.cfReference.preventSubmitOnEnter === true && this.inputElement.hasAttribute('rows') && parseInt(this.inputElement.getAttribute('rows')) > 1) {
                return;
            }
            // prevent textarea line breaks
            if (event.keyCode == cf.Dictionary.keyCodes["enter"] && !event.shiftKey) {
                event.preventDefault();
            }
        };
        UserTextInput.prototype.isControlElementsActiveAndUserInputHidden = function () {
            return this.controlElements && this.controlElements.active && cf.UserInputElement.hideUserInputOnNoneTextInput;
        };
        UserTextInput.prototype.onKeyUp = function (event) {
            if ((!this.active && !this.isControlElementsActiveAndUserInputHidden()) && !this.controlElements.focus)
                return;
            if (this.isMetaKeyPressed(event))
                return;
            if (event.keyCode == cf.Dictionary.keyCodes["shift"]) {
                this.shiftIsDown = false;
            }
            else if (event.keyCode == cf.Dictionary.keyCodes["up"]) {
                event.preventDefault();
                if (this.active && !this.controlElements.focus)
                    this.controlElements.focusFrom("bottom");
            }
            else if (event.keyCode == cf.Dictionary.keyCodes["down"]) {
                event.preventDefault();
                if (this.active && !this.controlElements.focus)
                    this.controlElements.focusFrom("top");
            }
            else if (event.keyCode == cf.Dictionary.keyCodes["tab"]) {
                // tab key pressed, check if node is child of CF, if then then reset focus to input element
                var doesKeyTargetExistInCF = false;
                var node = event.target.parentNode;
                while (node != null) {
                    if (node === this.cfReference.el) {
                        doesKeyTargetExistInCF = true;
                        break;
                    }
                    node = node.parentNode;
                }
                // prevent normal behaviour, we are not here to take part, we are here to take over!
                if (!doesKeyTargetExistInCF) {
                    event.preventDefault();
                    if (!this.controlElements.active)
                        this.setFocusOnInput();
                }
            }
            if (this.el.hasAttribute("disabled"))
                return;
            var value = this.getFlowDTO();
            if ((event.keyCode == cf.Dictionary.keyCodes["enter"] && !event.shiftKey) || event.keyCode == cf.Dictionary.keyCodes["space"]) {
                if (event.keyCode == cf.Dictionary.keyCodes["enter"] && this.active) {
                    if (this.cfReference.preventSubmitOnEnter === true)
                        return;
                    event.preventDefault();
                    this.onEnterOrSubmitButtonSubmit();
                }
                else {
                    // either click on submit button or do something with control elements
                    if (event.keyCode == cf.Dictionary.keyCodes["enter"] || event.keyCode == cf.Dictionary.keyCodes["space"]) {
                        event.preventDefault();
                        var tagType = this._currentTag.type == "group" ? this._currentTag.getGroupTagType() : this._currentTag.type;
                        if (tagType == "select" || tagType == "checkbox") {
                            var mutiTag = this._currentTag;
                            // if select or checkbox then check for multi select item
                            if (tagType == "checkbox" || mutiTag.multipleChoice) {
                                if ((this.active || this.isControlElementsActiveAndUserInputHidden()) && event.keyCode == cf.Dictionary.keyCodes["enter"]) {
                                    // click on UserTextInput submit button, only ENTER allowed
                                    this.submitButton.click();
                                }
                                else {
                                    // let UI know that we changed the key
                                    if (!this.active && !this.controlElements.active && !this.isControlElementsActiveAndUserInputHidden()) {
                                        // after ui has been selected we RESET the input/filter
                                        this.resetValue();
                                        this.setFocusOnInput();
                                    }
                                    this.dispatchKeyChange(value, event.keyCode);
                                }
                            }
                            else {
                                this.dispatchKeyChange(value, event.keyCode);
                            }
                        }
                        else {
                            if (this._currentTag.type == "group") {
                                // let the controlements handle action
                                this.dispatchKeyChange(value, event.keyCode);
                            }
                        }
                    }
                    else if (event.keyCode == cf.Dictionary.keyCodes["space"] && document.activeElement) {
                        this.dispatchKeyChange(value, event.keyCode);
                    }
                }
            }
            else if (event.keyCode != cf.Dictionary.keyCodes["shift"] && event.keyCode != cf.Dictionary.keyCodes["tab"]) {
                this.dispatchKeyChange(value, event.keyCode);
            }
            this.onInputChange();
        };
        UserTextInput.prototype.dispatchKeyChange = function (dto, keyCode) {
            // typing --->
            this.submitButton.typing = dto.text && dto.text.length > 0;
            cf.ConversationalForm.illustrateFlow(this, "dispatch", cf.UserInputEvents.KEY_CHANGE, dto);
            this.eventTarget.dispatchEvent(new CustomEvent(cf.UserInputEvents.KEY_CHANGE, {
                detail: {
                    dto: dto,
                    keyCode: keyCode,
                    inputFieldActive: this.active
                }
            }));
        };
        UserTextInput.prototype.windowFocus = function (event) {
            _super.prototype.windowFocus.call(this, event);
            this.setFocusOnInput();
        };
        UserTextInput.prototype.onInputBlur = function (event) {
            this._active = false;
            this.eventTarget.dispatchEvent(new CustomEvent(cf.UserInputEvents.BLUR));
        };
        UserTextInput.prototype.onInputFocus = function (event) {
            this._active = true;
            this.onInputChange();
            this.eventTarget.dispatchEvent(new CustomEvent(cf.UserInputEvents.FOCUS));
        };
        UserTextInput.prototype.setFocusOnInput = function () {
            if (!cf.UserInputElement.preventAutoFocus && !this.el.classList.contains("hide-input")) {
                this.inputElement.focus();
            }
        };
        UserTextInput.prototype.onEnterOrSubmitButtonSubmit = function (event) {
            if (event === void 0) { event = null; }
            var isControlElementsActiveAndUserInputHidden = this.controlElements.active && cf.UserInputElement.hideUserInputOnNoneTextInput;
            if ((this.active || isControlElementsActiveAndUserInputHidden) && this.controlElements.highlighted) {
                // active input field and focus on control elements happens when a control element is highlighted
                this.controlElements.clickOnHighlighted();
            }
            else {
                if (!this._currentTag) {
                    // happens when a form is empty, so just play along and submit response to chatlist..
                    this.eventTarget.cf.addUserChatResponse(this.inputElement.value);
                }
                else {
                    // we need to check if current tag is file
                    if (this._currentTag.type == "file" && event) {
                        // trigger <input type="file" but only when it's from clicking button
                        this.controlElements.getElement(0).triggerFileSelect();
                    }
                    else {
                        // for groups, we expect that there is always a default value set
                        this.doSubmit();
                    }
                }
            }
        };
        UserTextInput.prototype.doSubmit = function () {
            var dto = this.getFlowDTO();
            this.submitButton.loading = true;
            this.disabled = true;
            this.el.removeAttribute("error");
            this.inputElement.setAttribute("data-value", "");
            cf.ConversationalForm.illustrateFlow(this, "dispatch", cf.UserInputEvents.SUBMIT, dto);
            this.eventTarget.dispatchEvent(new CustomEvent(cf.UserInputEvents.SUBMIT, {
                detail: dto
            }));
        };
        UserTextInput.prototype.resetValue = function () {
            this.inputElement.value = "";
            if (this.inputElement.hasAttribute('rows'))
                this.inputElement.setAttribute('rows', '1');
            this.onInputChange();
        };
        UserTextInput.prototype.dealloc = function () {
            this.inputElement.removeEventListener('blur', this.onInputBlurCallback, false);
            this.onInputBlurCallback = null;
            this.inputElement.removeEventListener('focus', this.onInputFocusCallback, false);
            this.onInputFocusCallback = null;
            document.removeEventListener("keydown", this.keyDownCallback, false);
            this.keyDownCallback = null;
            document.removeEventListener("keyup", this.keyUpCallback, false);
            this.keyUpCallback = null;
            this.eventTarget.removeEventListener(cf.ControlElementEvents.SUBMIT_VALUE, this.onControlElementSubmitCallback, false);
            this.onControlElementSubmitCallback = null;
            // remove submit button instance
            this.submitButton.el.removeEventListener(cf.UserInputSubmitButtonEvents.CHANGE, this.onSubmitButtonChangeStateCallback, false);
            this.onSubmitButtonChangeStateCallback = null;
            this.submitButton.dealloc();
            this.submitButton = null;
            _super.prototype.dealloc.call(this);
        };
        // override
        UserTextInput.prototype.getTemplate = function () {
            return this.customTemplate || "<cf-input>\n\t\t\t\t<cf-info></cf-info>\n\t\t\t\t<cf-input-control-elements>\n\t\t\t\t\t<cf-list-button direction=\"prev\">\n\t\t\t\t\t</cf-list-button>\n\t\t\t\t\t<cf-list-button direction=\"next\">\n\t\t\t\t\t</cf-list-button>\n\t\t\t\t\t<cf-list>\n\t\t\t\t\t</cf-list>\n\t\t\t\t</cf-input-control-elements>\n\t\t\t\t<div class=\"inputWrapper\">\n\t\t\t\t\t<textarea type='input' tabindex=\"1\" rows=\"1\"></textarea>\n\t\t\t\t</div>\n\t\t\t</cf-input>\n\t\t\t";
        };
        return UserTextInput;
    }(cf.UserInputElement));
    cf.UserTextInput = UserTextInput;
})(cf || (cf = {}));

/// <reference path="../BasicElement.ts"/>
/// <reference path="../../logic/Helpers.ts"/>
/// <reference path="../../ConversationalForm.ts"/>
/// <reference path="../../interfaces/IUserInterfaceOptions.ts"/>
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
// namespace
var cf;
(function (cf) {
    cf.ChatResponseEvents = {
        USER_ANSWER_CLICKED: "cf-on-user-answer-clicked"
    };
    // class
    var ChatResponse = /** @class */ (function (_super) {
        __extends(ChatResponse, _super);
        function ChatResponse(options) {
            var _this = _super.call(this, options) || this;
            _this.container = options.container;
            _this.uiOptions = options.cfReference.uiOptions;
            _this._tag = options.tag;
            return _this;
        }
        Object.defineProperty(ChatResponse.prototype, "tag", {
            get: function () {
                return this._tag;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ChatResponse.prototype, "added", {
            get: function () {
                return !!this.el || !!this.el.parentNode || !!this.el.parentNode.parentNode;
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ChatResponse.prototype, "disabled", {
            get: function () {
                return this.el.classList.contains("disabled");
            },
            set: function (value) {
                if (value)
                    this.el.classList.add("disabled");
                else
                    this.el.classList.remove("disabled");
            },
            enumerable: true,
            configurable: true
        });
        /**
         * We depend on scroll in a column-reverse flex container. This is where Edge and Firefox comes up short
         */
        ChatResponse.prototype.hasFlexBug = function () {
            return this.cfReference.el.classList.contains('browser-firefox') || this.cfReference.el.classList.contains('browser-edge');
        };
        ChatResponse.prototype.animateIn = function () {
            var _this = this;
            var outer = document.querySelector('scrollable');
            var inner = document.querySelector('.scrollableInner');
            if (this.hasFlexBug())
                inner.classList.remove('scroll');
            requestAnimationFrame(function () {
                var height = _this.el.scrollHeight;
                _this.el.style.height = '0px';
                requestAnimationFrame(function () {
                    _this.el.style.height = height + 'px';
                    _this.el.classList.add('show');
                    // Listen for transitionend and set to height:auto
                    try {
                        var sm = window.getComputedStyle(document.querySelectorAll('p.show')[0]);
                        var cssAnimationTime = +sm.animationDuration.replace('s', ''); // format '0.234234xs
                        var cssAnimationDelayTime = +sm.animationDelay.replace('s', '');
                        setTimeout(function () {
                            _this.el.style.height = 'auto';
                            if (_this.hasFlexBug() && inner.scrollHeight > outer.offsetHeight) {
                                inner.classList.add('scroll');
                                inner.scrollTop = inner.scrollHeight;
                            }
                        }, (cssAnimationTime + cssAnimationDelayTime) * 1500);
                    }
                    catch (err) {
                        // Fallback method. Assuming animations do not take longer than 1000ms
                        setTimeout(function () {
                            if (_this.hasFlexBug() && inner.scrollHeight > outer.offsetHeight) {
                                inner.classList.add('scroll');
                                inner.scrollTop = inner.scrollHeight;
                            }
                            _this.el.style.height = 'auto';
                        }, 3000);
                    }
                });
            });
        };
        Object.defineProperty(ChatResponse.prototype, "visible", {
            set: function (value) {
            },
            enumerable: true,
            configurable: true
        });
        Object.defineProperty(ChatResponse.prototype, "strippedSesponse", {
            get: function () {
                var html = this.response;
                // use browsers native way of stripping
                var div = document.createElement("div");
                div.innerHTML = html;
                return div.textContent || div.innerText || "";
            },
            enumerable: true,
            configurable: true
        });
        ChatResponse.prototype.whenReady = function (resolve) {
            this.onReadyCallback = resolve;
        };
        ChatResponse.prototype.setValue = function (dto) {
            // if(!this.visible){
            // 	this.visible = true;
            // }
            if (dto === void 0) { dto = null; }
            var isThinking = this.el.hasAttribute("thinking");
            if (!dto) {
                this.setToThinking();
            }
            else {
                // same same
                this.response = this.originalResponse = dto.text;
                this.processResponseAndSetText();
                if (this.responseLink && !this.isRobotResponse) {
                    // call robot and update for binding values ->
                    this.responseLink.processResponseAndSetText();
                }
                // check for if response type is file upload...
                if (dto && dto.controlElements && dto.controlElements[0]) {
                    switch (dto.controlElements[0].type) {
                        case "UploadFileUI":
                            this.textEl.classList.add("file-icon");
                            break;
                    }
                }
                if (!this.isRobotResponse && !this.onClickCallback) {
                    // edit
                    this.onClickCallback = this.onClick.bind(this);
                    this.el.addEventListener(cf.Helpers.getMouseEvent("click"), this.onClickCallback, false);
                }
            }
        };
        ChatResponse.prototype.show = function () {
            this.visible = true;
            this.disabled = false;
            if (!this.response) {
                this.setToThinking();
            }
            else {
                this.checkForEditMode();
            }
        };
        ChatResponse.prototype.updateThumbnail = function (src) {
            var thumbEl = this.el.getElementsByTagName("thumb")[0];
            if (src.indexOf("text:") === 0) {
                var thumbElSpan = thumbEl.getElementsByTagName("span")[0];
                thumbElSpan.innerHTML = src.split("text:")[1];
                thumbElSpan.setAttribute("length", src.length.toString());
            }
            else {
                this.image = src;
                thumbEl.style.backgroundImage = 'url("' + this.image + '")';
            }
        };
        ChatResponse.prototype.setLinkToOtherReponse = function (response) {
            // link reponse to another one, keeping the update circle complete.
            this.responseLink = response;
        };
        ChatResponse.prototype.processResponseAndSetText = function () {
            var _this = this;
            if (!this.originalResponse)
                return;
            var innerResponse = this.originalResponse;
            if (this._tag && this._tag.type == "password" && !this.isRobotResponse) {
                var newStr = "";
                for (var i_1 = 0; i_1 < innerResponse.length; i_1++) {
                    newStr += "*";
                }
                innerResponse = newStr;
            }
            // if robot, then check linked response for binding values
            if (this.responseLink && this.isRobotResponse) {
                // one way data binding values:
                innerResponse = innerResponse.split("{previous-answer}").join(this.responseLink.parsedResponse);
            }
            if (this.isRobotResponse) {
                // Piping, look through IDs, and map values to dynamics
                var reponses = ChatResponse.list.getResponses();
                for (var i = 0; i < reponses.length; i++) {
                    var response = reponses[i];
                    if (response !== this) {
                        if (response.tag) {
                            // check for id, standard
                            if (response.tag.id) {
                                innerResponse = innerResponse.split("{" + response.tag.id + "}").join(response.tag.value);
                            }
                            //fallback check for name
                            if (response.tag.name) {
                                innerResponse = innerResponse.split("{" + response.tag.name + "}").join(response.tag.value);
                            }
                        }
                    }
                }
            }
            // check if response contains an image as answer
            var responseContains = innerResponse.indexOf("contains-image") != -1;
            if (responseContains)
                this.textEl.classList.add("contains-image");
            // now set it
            if (this.isRobotResponse) {
                this.textEl.innerHTML = "";
                if (!this.uiOptions)
                    this.uiOptions = this.cfReference.uiOptions; // On edit uiOptions are empty, so this mitigates the problem. Not ideal.
                var robotInitResponseTime = this.uiOptions.robot.robotResponseTime;
                if (robotInitResponseTime != 0) {
                    this.setToThinking();
                }
                // robot response, allow for && for multiple responses
                var chainedResponses = innerResponse.split("&&");
                if (robotInitResponseTime === 0) {
                    for (var i_2 = 0; i_2 < chainedResponses.length; i_2++) {
                        var str = chainedResponses[i_2];
                        this.textEl.innerHTML += "<p>" + str + "</p>";
                    }
                    var _loop_1 = function (i_3) {
                        setTimeout(function () {
                            _this.tryClearThinking();
                            var p = _this.textEl.getElementsByTagName("p");
                            p[i_3].classList.add("show");
                            _this.scrollTo();
                        }, chainedResponses.length > 1 && i_3 > 0 ? robotInitResponseTime + ((i_3 + 1) * this_1.uiOptions.robot.chainedResponseTime) : 0);
                    };
                    var this_1 = this;
                    for (var i_3 = 0; i_3 < chainedResponses.length; i_3++) {
                        _loop_1(i_3);
                    }
                }
                else {
                    var _loop_2 = function (i_4) {
                        var revealAfter = robotInitResponseTime + (i_4 * this_2.uiOptions.robot.chainedResponseTime);
                        var str = chainedResponses[i_4];
                        setTimeout(function () {
                            _this.tryClearThinking();
                            _this.textEl.innerHTML += "<p>" + str + "</p>";
                            var p = _this.textEl.getElementsByTagName("p");
                            p[i_4].classList.add("show");
                            _this.scrollTo();
                        }, revealAfter);
                    };
                    var this_2 = this;
                    for (var i_4 = 0; i_4 < chainedResponses.length; i_4++) {
                        _loop_2(i_4);
                    }
                }
                this.readyTimer = setTimeout(function () {
                    if (_this.onReadyCallback)
                        _this.onReadyCallback();
                    // reset, as it can be called again
                    _this.onReadyCallback = null;
                    if (_this._tag && _this._tag.skipUserInput === true) {
                        setTimeout(function () {
                            _this._tag.flowManager.nextStep();
                            _this._tag.skipUserInput = false; // to avoid nextStep being fired again as this would make the flow jump too far when editing a response
                        }, _this.uiOptions.robot.chainedResponseTime);
                    }
                }, robotInitResponseTime + (chainedResponses.length * this.uiOptions.robot.chainedResponseTime));
            }
            else {
                // user response, act normal
                this.tryClearThinking();
                var hasImage = innerResponse.indexOf('<img') > -1;
                var imageRegex = new RegExp('<img[^>]*?>', 'g');
                var imageTag = innerResponse.match(imageRegex);
                if (hasImage && imageTag) {
                    innerResponse = innerResponse.replace(imageTag[0], '');
                    this.textEl.innerHTML = "<p class=\"hasImage\">" + imageTag + "<span>" + innerResponse + "</span></p>";
                }
                else {
                    this.textEl.innerHTML = "<p>" + innerResponse + "</p>";
                }
                var p = this.textEl.getElementsByTagName("p");
                p[p.length - 1].offsetWidth;
                p[p.length - 1].classList.add("show");
                this.scrollTo();
            }
            this.parsedResponse = innerResponse;
            // }
            // value set, so add element, if not added
            if (this.uiOptions.robot
                && this.uiOptions.robot.robotResponseTime === 0) {
                this.addSelf();
            }
            else {
                setTimeout(function () {
                    _this.addSelf();
                }, 0);
            }
            // bounce
            this.textEl.removeAttribute("value-added");
            setTimeout(function () {
                _this.textEl.setAttribute("value-added", "");
                _this.el.classList.add("peak-thumb");
            }, 0);
            this.checkForEditMode();
            // update response
            // remove the double ampersands if present
            this.response = innerResponse.split("&&").join(" ");
        };
        ChatResponse.prototype.scrollTo = function () {
            var y = this.el.offsetTop;
            var h = this.el.offsetHeight;
            if (!this.container && this.el)
                this.container = this.el; // On edit this.container is empty so this is a fix to reassign it. Not ideal, but...
            if (this.container
                && this.container.parentElement
                && this.container.parentElement.scrollHeight) {
                this.container.parentElement.scrollTop = y + h + this.container.parentElement.scrollHeight;
            }
        };
        ChatResponse.prototype.checkForEditMode = function () {
            if (!this.isRobotResponse && !this.el.hasAttribute("thinking")) {
                this.el.classList.add("can-edit");
                this.disabled = false;
            }
        };
        ChatResponse.prototype.tryClearThinking = function () {
            if (this.el.hasAttribute("thinking")) {
                this.textEl.innerHTML = "";
                this.el.removeAttribute("thinking");
            }
        };
        ChatResponse.prototype.setToThinking = function () {
            var canShowThinking = (this.isRobotResponse && this.uiOptions.robot.robotResponseTime !== 0) || (!this.isRobotResponse && this.cfReference.uiOptions.user.showThinking && !this._tag.skipUserInput);
            if (canShowThinking) {
                this.textEl.innerHTML = ChatResponse.THINKING_MARKUP;
                this.el.classList.remove("can-edit");
                this.el.setAttribute("thinking", "");
            }
            if (this.cfReference.uiOptions.user.showThinking || this.cfReference.uiOptions.user.showThumb) {
                this.addSelf();
            }
        };
        /**
        * @name addSelf
        * add one self to the chat list
        */
        ChatResponse.prototype.addSelf = function () {
            if (this.el.parentNode != this.container) {
                this.container.appendChild(this.el);
                this.animateIn();
            }
        };
        /**
        * @name onClickCallback
        * click handler for el
        */
        ChatResponse.prototype.onClick = function (event) {
            this.setToThinking();
            cf.ConversationalForm.illustrateFlow(this, "dispatch", cf.ChatResponseEvents.USER_ANSWER_CLICKED, event);
            this.eventTarget.dispatchEvent(new CustomEvent(cf.ChatResponseEvents.USER_ANSWER_CLICKED, {
                detail: this._tag
            }));
        };
        ChatResponse.prototype.setData = function (options) {
            this.image = options.image;
            this.response = this.originalResponse = options.response;
            this.isRobotResponse = options.isRobotResponse;
            _super.prototype.setData.call(this, options);
        };
        ChatResponse.prototype.onElementCreated = function () {
            var _this = this;
            this.textEl = this.el.getElementsByTagName("text")[0];
            this.updateThumbnail(this.image);
            if (this.isRobotResponse || this.response != null) {
                // Robot is pseudo thinking, can also be user -->
                // , but if addUserChatResponse is called from ConversationalForm, then the value is there, therefore skip ...
                setTimeout(function () {
                    _this.setValue({ text: _this.response });
                }, 0);
                //ConversationalForm.animationsEnabled ? Helpers.lerp(Math.random(), 500, 900) : 0);
            }
            else {
                if (this.cfReference.uiOptions.user.showThumb) {
                    this.el.classList.add("peak-thumb");
                }
            }
        };
        ChatResponse.prototype.dealloc = function () {
            clearTimeout(this.readyTimer);
            this.container = null;
            this.uiOptions = null;
            this.onReadyCallback = null;
            if (this.onClickCallback) {
                this.el.removeEventListener(cf.Helpers.getMouseEvent("click"), this.onClickCallback, false);
                this.onClickCallback = null;
            }
            _super.prototype.dealloc.call(this);
        };
        // template, can be overwritten ...
        ChatResponse.prototype.getTemplate = function () {
            return "<cf-chat-response class=\"" + (this.isRobotResponse ? "robot" : "user") + "\">\n\t\t\t\t<thumb><span></span></thumb>\n\t\t\t\t<text></text>\n\t\t\t</cf-chat-response>";
        };
        ChatResponse.THINKING_MARKUP = "<p class='show'><thinking><span>.</span><span>.</span><span>.</span></thinking></p>";
        return ChatResponse;
    }(cf.BasicElement));
    cf.ChatResponse = ChatResponse;
})(cf || (cf = {}));

/// <reference path="ChatResponse.ts"/>
/// <reference path="../BasicElement.ts"/>
/// <reference path="../../logic/FlowManager.ts"/>
var __extends = (this && this.__extends) || (function () {
    var extendStatics = function (d, b) {
        extendStatics = Object.setPrototypeOf ||
            ({ __proto__: [] } instanceof Array && function (d, b) { d.__proto__ = b; }) ||
            function (d, b) { for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p]; };
        return extendStatics(d, b);
    }
    return function (d, b) {
        extendStatics(d, b);
        function __() { this.constructor = d; }
        d.prototype = b === null ? Object.create(b) : (__.prototype = b.prototype, new __());
    };
})();
// namespace
var cf;
(function (cf) {
    // interface
    cf.ChatListEvents = {
        CHATLIST_UPDATED: "cf-chatlist-updated"
    };
    // class
    var ChatList = /** @class */ (function (_super) {
        __extends(ChatList, _super);
        function ChatList(options) {
            var _this = _super.call(this, options) || this;
            _this.updateTimer = 0;
            cf.ChatResponse.list = _this;
            _this.responses = [];
            // flow update
            _this.flowUpdateCallback = _this.onFlowUpdate.bind(_this);
            _this.eventTarget.addEventListener(cf.FlowEvents.FLOW_UPDATE, _this.flowUpdateCallback, false);
            // user input update
            _this.userInputUpdateCallback = _this.onUserInputUpdate.bind(_this);
            _this.eventTarget.addEventListener(cf.FlowEvents.USER_INPUT_UPDATE, _this.userInputUpdateCallback, false);
            // user input key change
            _this.onInputKeyChangeCallback = _this.onInputKeyChange.bind(_this);
            _this.eventTarget.addEventListener(cf.UserInputEvents.KEY_CHANGE, _this.onInputKeyChangeCallback, false);
            // user input height change
            _this.onInputHeightChangeCallback = _this.onInputHeightChange.bind(_this);
            _this.eventTarget.addEventListener(cf.UserInputEvents.HEIGHT_CHANGE, _this.onInputHeightChangeCallback, false);
            // on control elements changed
            _this.onControlElementsResizedCallback = _this.onControlElementsResized.bind(_this);
            _this.eventTarget.addEventListener(cf.ControlElementsEvents.ON_RESIZE, _this.onControlElementsResizedCallback, false);
            _this.onControlElementsChangedCallback = _this.onControlElementsChanged.bind(_this);
            _this.eventTarget.addEventListener(cf.ControlElementsEvents.CHANGED, _this.onControlElementsChangedCallback, false);
            return _this;
        }
        ChatList.prototype.onInputHeightChange = function (event) {
            var dto = event.detail.dto;
            cf.ConversationalForm.illustrateFlow(this, "receive", event.type, dto);
            // this.input.controlElements.el.style.transition = "height 2s ease-out";
            // this.input.controlElements.el.style.height = this.input.controlElements.el.scrollHeight + 'px';
            this.onInputElementChanged();
        };
        ChatList.prototype.onInputKeyChange = function (event) {
            var dto = event.detail.dto;
            cf.ConversationalForm.illustrateFlow(this, "receive", event.type, dto);
        };
        ChatList.prototype.onUserInputUpdate = function (event) {
            cf.ConversationalForm.illustrateFlow(this, "receive", event.type, event.detail);
            if (this.currentUserResponse) {
                var response = event.detail;
                this.setCurrentUserResponse(response);
            }
        };
        ChatList.prototype.addInput = function (input) {
            this.input = input;
        };
        /**
        * @name onControlElementsChanged
        * on control elements change
        */
        ChatList.prototype.onControlElementsChanged = function (event) {
            this.onInputElementChanged();
        };
        /**
        * @name onControlElementsResized
        * on control elements resize
        */
        ChatList.prototype.onControlElementsResized = function (event) {
            cf.ConversationalForm.illustrateFlow(this, "receive", cf.ControlElementsEvents.ON_RESIZE);
            var responseToScrollTo = this.currentResponse;
            if (responseToScrollTo) {
                if (!responseToScrollTo.added) {
                    // element not added yet, so find closest
                    for (var i = this.responses.indexOf(responseToScrollTo); i >= 0; i--) {
                        var element = this.responses[i];
                        if (element.added) {
                            responseToScrollTo = element;
                            break;
                        }
                    }
                }
                responseToScrollTo.scrollTo();
            }
            this.onInputElementChanged();
        };
        ChatList.prototype.onInputElementChanged = function () {
            if (!this.cfReference || !this.cfReference.el)
                return;
            var cfHeight = this.cfReference.el.offsetHeight;
            var inputHeight = this.input.height;
            var listHeight = cfHeight - inputHeight;
            //this.el.style.height = listHeight + "px";
        };
        ChatList.prototype.onFlowUpdate = function (event) {
            var _this = this;
            cf.ConversationalForm.illustrateFlow(this, "receive", event.type, event.detail);
            var currentTag = event.detail.tag;
            if (this.currentResponse)
                this.currentResponse.disabled = false;
            if (this.containsTagResponse(currentTag) && !event.detail.ignoreExistingTag) {
                // because user maybe have scrolled up and wants to edit
                // tag is already in list, so re-activate it
                this.onUserWantsToEditTag(currentTag);
            }
            else {
                // robot response
                setTimeout(function () {
                    var robot = _this.createResponse(true, currentTag, currentTag.question);
                    robot.whenReady(function () {
                        // create user response
                        _this.currentUserResponse = _this.createResponse(false, currentTag);
                        robot.scrollTo();
                    });
                    if (_this.currentUserResponse) {
                        // linked, but only if we should not ignore existing tag
                        _this.currentUserResponse.setLinkToOtherReponse(robot);
                        robot.setLinkToOtherReponse(_this.currentUserResponse);
                    }
                }, this.responses.length === 0 ? 500 : 0);
            }
        };
        /**
        * @name containsTagResponse
        * @return boolean
        * check if tag has already been responded to
        */
        ChatList.prototype.containsTagResponse = function (tagToChange) {
            for (var i = 0; i < this.responses.length; i++) {
                var element = this.responses[i];
                if (!element.isRobotResponse && element.tag == tagToChange && !tagToChange.hasConditions()) {
                    return true;
                }
            }
            return false;
        };
        /**
        * @name onUserAnswerClicked
        * on user ChatReponse clicked
        */
        ChatList.prototype.onUserWantsToEditTag = function (tagToChange) {
            var responseUserWantsToEdit;
            for (var i = 0; i < this.responses.length; i++) {
                var element = this.responses[i];
                if (!element.isRobotResponse && element.tag == tagToChange) {
                    // update element thhat user wants to edit
                    responseUserWantsToEdit = element;
                    break;
                }
            }
            // reset the current user response
            this.currentUserResponse.processResponseAndSetText();
            if (responseUserWantsToEdit) {
                // remove latest user response, if it is there any, also make sure we don't remove the first one
                if (this.responses.length > 2) {
                    if (!this.responses[this.responses.length - 1].isRobotResponse) {
                        this.responses.pop().dealloc();
                    }
                    // remove latest robot response, it should always be a robot response
                    this.responses.pop().dealloc();
                }
                this.currentUserResponse = responseUserWantsToEdit;
                // TODO: Set user field to thinking?
                // this.currentUserResponse.setToThinking??
                this.currentResponse = this.responses[this.responses.length - 1];
                this.onListUpdate(this.currentUserResponse);
            }
        };
        ChatList.prototype.onListUpdate = function (chatResponse) {
            var _this = this;
            clearTimeout(this.updateTimer);
            this.updateTimer = setTimeout(function () {
                _this.eventTarget.dispatchEvent(new CustomEvent(cf.ChatListEvents.CHATLIST_UPDATED, {
                    detail: _this
                }));
                chatResponse.show();
            }, 0);
        };
        /**
        * @name clearFrom
        * remove responses, this usually happens if a user jumps back to a conditional element
        */
        ChatList.prototype.clearFrom = function (index) {
            index = index * 2; // double up because of robot responses
            index += index % 2; // round up so we dont remove the user response element
            while (this.responses.length > index) {
                this.responses.pop().dealloc();
            }
        };
        /**
        * @name setCurrentUserResponse
        * Update current reponse, is being called automatically from onFlowUpdate, but can also, in rare cases, be called when flow is controlled manually.
        * reponse: FlowDTO
        */
        ChatList.prototype.setCurrentUserResponse = function (dto) {
            this.flowDTOFromUserInputUpdate = dto;
            if (!this.flowDTOFromUserInputUpdate.text && dto.tag) {
                if (dto.tag.type == "group") {
                    this.flowDTOFromUserInputUpdate.text = cf.Dictionary.get("user-reponse-missing-group");
                }
                else if (dto.tag.type != "password") {
                    this.flowDTOFromUserInputUpdate.text = cf.Dictionary.get("user-reponse-missing");
                }
            }
            this.currentUserResponse.setValue(this.flowDTOFromUserInputUpdate);
        };
        /**
        * @name getResponses
        * returns the submitted responses.
        */
        ChatList.prototype.getResponses = function () {
            return this.responses;
        };
        ChatList.prototype.updateThumbnail = function (robot, img) {
            cf.Dictionary.set(robot ? "robot-image" : "user-image", robot ? "robot" : "human", img);
            var newImage = robot ? cf.Dictionary.getRobotResponse("robot-image") : cf.Dictionary.get("user-image");
            for (var i = 0; i < this.responses.length; i++) {
                var element = this.responses[i];
                if (robot && element.isRobotResponse) {
                    element.updateThumbnail(newImage);
                }
                else if (!robot && !element.isRobotResponse) {
                    element.updateThumbnail(newImage);
                }
            }
        };
        ChatList.prototype.createResponse = function (isRobotResponse, currentTag, value) {
            if (value === void 0) { value = null; }
            var scrollable = this.el.querySelector(".scrollableInner");
            var response = new cf.ChatResponse({
                // image: null,
                cfReference: this.cfReference,
                list: this,
                tag: currentTag,
                eventTarget: this.eventTarget,
                isRobotResponse: isRobotResponse,
                response: value,
                image: isRobotResponse ? cf.Dictionary.getRobotResponse("robot-image") : cf.Dictionary.get("user-image"),
                container: scrollable
            });
            this.responses.push(response);
            this.currentResponse = response;
            this.onListUpdate(response);
            return response;
        };
        ChatList.prototype.getTemplate = function () {
            return "<cf-chat type='pluto'>\n\t\t\t\t\t\t<scrollable>\n\t\t\t\t\t\t\t<div class=\"scrollableInner\"></div>\n\t\t\t\t\t\t</scrollable>\n\t\t\t\t\t</cf-chat>";
        };
        ChatList.prototype.dealloc = function () {
            this.eventTarget.removeEventListener(cf.FlowEvents.FLOW_UPDATE, this.flowUpdateCallback, false);
            this.flowUpdateCallback = null;
            this.eventTarget.removeEventListener(cf.FlowEvents.USER_INPUT_UPDATE, this.userInputUpdateCallback, false);
            this.userInputUpdateCallback = null;
            this.eventTarget.removeEventListener(cf.UserInputEvents.KEY_CHANGE, this.onInputKeyChangeCallback, false);
            this.onInputKeyChangeCallback = null;
            _super.prototype.dealloc.call(this);
        };
        return ChatList;
    }(cf.BasicElement));
    cf.ChatList = ChatList;
})(cf || (cf = {}));

/// <reference path="../form-tags/Tag.ts"/>
/// <reference path="../ConversationalForm.ts"/>
var cf;
(function (cf) {
    // interface
    cf.FlowEvents = {
        USER_INPUT_UPDATE: "cf-flow-user-input-update",
        USER_INPUT_INVALID: "cf-flow-user-input-invalid",
        //	detail: string
        FLOW_UPDATE: "cf-flow-update",
        FORM_SUBMIT: "cf-form-submit",
    };
    // class
    var FlowManager = /** @class */ (function () {
        function FlowManager(options) {
            this.stopped = false;
            this.maxSteps = 0;
            this.step = 0;
            this.savedStep = -1;
            this.stepTimer = 0;
            /**
            * ignoreExistingTags
            * @type boolean
            * ignore existing tags, usually this is set to true when using startFrom, where you don't want it to check for exisintg tags in the list
            */
            this.ignoreExistingTags = false;
            this.cfReference = options.cfReference;
            this.eventTarget = options.eventTarget;
            this.flowStepCallback = options.flowStepCallback;
            this.setTags(options.tags);
            this.userInputSubmitCallback = this.userInputSubmit.bind(this);
            this.eventTarget.addEventListener(cf.UserInputEvents.SUBMIT, this.userInputSubmitCallback, false);
        }
        Object.defineProperty(FlowManager.prototype, "currentTag", {
            get: function () {
                return this.tags[this.step];
            },
            enumerable: true,
            configurable: true
        });
        FlowManager.prototype.userInputSubmit = function (event) {
            var _this = this;
            cf.ConversationalForm.illustrateFlow(this, "receive", event.type, event.detail);
            var appDTO = event.detail;
            if (!appDTO.tag)
                appDTO.tag = this.currentTag;
            var isTagValid = this.currentTag.setTagValueAndIsValid(appDTO);
            var hasCheckedForTagSpecificValidation = false;
            var hasCheckedForGlobalFlowValidation = false;
            var onValidationCallback = function () {
                // check 1
                if (_this.currentTag.validationCallback && typeof _this.currentTag.validationCallback == "function") {
                    if (!hasCheckedForTagSpecificValidation && isTagValid) {
                        hasCheckedForTagSpecificValidation = true;
                        _this.currentTag.validationCallback(appDTO, function () {
                            isTagValid = true;
                            onValidationCallback();
                        }, function (optionalErrorMessage) {
                            isTagValid = false;
                            if (optionalErrorMessage)
                                appDTO.errorText = optionalErrorMessage;
                            onValidationCallback();
                        });
                        return;
                    }
                }
                // check 2, this.currentTag.required <- required should be handled in the callback.
                if (_this.flowStepCallback && typeof _this.flowStepCallback == "function") {
                    if (!hasCheckedForGlobalFlowValidation && isTagValid) {
                        hasCheckedForGlobalFlowValidation = true;
                        // use global validationCallback method
                        _this.flowStepCallback(appDTO, function () {
                            isTagValid = true;
                            onValidationCallback();
                        }, function (optionalErrorMessage) {
                            isTagValid = false;
                            if (optionalErrorMessage)
                                appDTO.errorText = optionalErrorMessage;
                            onValidationCallback();
                        });
                        return;
                    }
                }
                // go on with the flow
                if (isTagValid) {
                    // do the normal flow..
                    cf.ConversationalForm.illustrateFlow(_this, "dispatch", cf.FlowEvents.USER_INPUT_UPDATE, appDTO);
                    // update to latest DTO because values can be changed in validation flow...
                    if (appDTO.input)
                        appDTO = appDTO.input.getFlowDTO();
                    _this.eventTarget.dispatchEvent(new CustomEvent(cf.FlowEvents.USER_INPUT_UPDATE, {
                        detail: appDTO //UserTextInput value
                    }));
                    // goto next step when user has answered
                    setTimeout(function () { return _this.nextStep(); }, cf.ConversationalForm.animationsEnabled ? 250 : 0);
                }
                else {
                    cf.ConversationalForm.illustrateFlow(_this, "dispatch", cf.FlowEvents.USER_INPUT_INVALID, appDTO);
                    // Value not valid
                    _this.eventTarget.dispatchEvent(new CustomEvent(cf.FlowEvents.USER_INPUT_INVALID, {
                        detail: appDTO //UserTextInput value
                    }));
                }
            };
            // TODO, make into promises when IE is rolling with it..
            onValidationCallback();
        };
        FlowManager.prototype.startFrom = function (indexOrTag, ignoreExistingTags) {
            if (ignoreExistingTags === void 0) { ignoreExistingTags = false; }
            if (typeof indexOrTag == "number")
                this.step = indexOrTag;
            else {
                // find the index..
                this.step = this.tags.indexOf(indexOrTag);
            }
            this.ignoreExistingTags = ignoreExistingTags;
            if (!this.ignoreExistingTags) {
                this.editTag(this.tags[this.step]);
            }
            else {
                //validate step, and ask for skipping of current step
                this.showStep();
            }
        };
        FlowManager.prototype.areConditionsInFlowFullfilled = function (tagWithConditions, tagConditions) {
            if (!this.activeConditions) {
                // we don't use this (yet), it's only to keep track of active conditions
                this.activeConditions = [];
            }
            var numConditionsFound = 0;
            // find out if tagWithConditions fullfills conditions
            for (var i = 0; i < this.tags.length; i++) {
                var tag = this.tags[i];
                if (tag !== tagWithConditions) {
                    // check if tags are fullfilled
                    for (var j = 0; j < tagConditions.length; j++) {
                        var tagCondition = tagConditions[j];
                        // only check tags where tag id or name is defined
                        var tagName = (tag.name || tag.id || "").toLowerCase();
                        if (tagName !== "" && "cf-conditional-" + tagName === tagCondition.key.toLowerCase()) {
                            // key found, so check condition
                            var flowTagValue = typeof tag.value === "string" ? tag.value : tag.value;
                            var areConditionsMeet = cf.Tag.testConditions(flowTagValue, tagCondition);
                            if (areConditionsMeet) {
                                this.activeConditions[tagName] = tagConditions;
                                // conditions are meet
                                if (++numConditionsFound == tagConditions.length) {
                                    return true;
                                }
                            }
                        }
                    }
                }
            }
            return false;
        };
        FlowManager.prototype.start = function () {
            this.stopped = false;
            this.validateStepAndUpdate();
        };
        FlowManager.prototype.stop = function () {
            this.stopped = true;
        };
        FlowManager.prototype.nextStep = function () {
            if (this.stopped)
                return;
            if (this.savedStep != -1) {
                // if you are looking for where the none EDIT tag conditionsl check is done
                // then look at a tags disabled getter
                var foundConditionsToCurrentTag = false;
                // this happens when editing a tag..
                // check if any tags has a conditional check for this.currentTag.name
                for (var i = 0; i < this.tags.length; i++) {
                    var tag = this.tags[i];
                    if (tag !== this.currentTag && tag.hasConditions()) {
                        // tag has conditions so check if it also has the right conditions
                        if (tag.hasConditionsFor(this.currentTag.name)) {
                            foundConditionsToCurrentTag = true;
                            this.step = this.tags.indexOf(this.currentTag);
                            break;
                        }
                    }
                }
                // no conditional linking found, so resume flow
                if (!foundConditionsToCurrentTag) {
                    this.step = this.savedStep;
                }
            }
            this.savedStep = -1; //reset saved step
            this.step++;
            this.validateStepAndUpdate();
        };
        FlowManager.prototype.previousStep = function () {
            this.step--;
            this.validateStepAndUpdate();
        };
        FlowManager.prototype.getStep = function () {
            return this.step;
        };
        FlowManager.prototype.addTags = function (tags, atIndex) {
            if (atIndex === void 0) { atIndex = -1; }
            // used to append new tag
            if (atIndex !== -1 && atIndex < this.tags.length) {
                var pre = this.tags.slice(0, atIndex);
                var post = this.tags.slice(atIndex, this.tags.length);
                this.tags = this.tags.slice(0, atIndex).concat(tags).concat(post);
            }
            else {
                this.tags = this.tags.concat(tags);
            }
            this.setTags(this.tags);
            return this.tags;
        };
        FlowManager.prototype.dealloc = function () {
            this.eventTarget.removeEventListener(cf.UserInputEvents.SUBMIT, this.userInputSubmitCallback, false);
            this.userInputSubmitCallback = null;
        };
        /**
        * @name editTag
        * go back in time and edit a tag.
        */
        FlowManager.prototype.editTag = function (tag) {
            this.ignoreExistingTags = false;
            this.savedStep = this.step - 1; //save step
            this.step = this.tags.indexOf(tag); // === this.currentTag
            this.validateStepAndUpdate();
            if (this.activeConditions && Object.keys(this.activeConditions).length > 0) {
                this.savedStep = -1; //don't save step, as we wont return
                // clear chatlist.
                this.cfReference.chatList.clearFrom(this.step + 1);
                //reset from active tag, brute force
                var editTagIndex = this.tags.indexOf(tag);
                for (var i = editTagIndex + 1; i < this.tags.length; i++) {
                    var tag_1 = this.tags[i];
                    tag_1.reset();
                }
            }
        };
        FlowManager.prototype.setTags = function (tags) {
            this.tags = tags;
            for (var i = 0; i < this.tags.length; i++) {
                var tag = this.tags[i];
                tag.eventTarget = this.eventTarget;
                tag.flowManager = this;
            }
            this.maxSteps = this.tags.length;
        };
        FlowManager.prototype.skipStep = function () {
            this.nextStep();
        };
        FlowManager.prototype.validateStepAndUpdate = function () {
            if (this.maxSteps > 0) {
                if (this.step == this.maxSteps) {
                    // console.warn("We are at the end..., submit click")
                    this.eventTarget.dispatchEvent(new CustomEvent(cf.FlowEvents.FORM_SUBMIT, {}));
                    this.cfReference.doSubmitForm();
                }
                else {
                    this.step %= this.maxSteps;
                    if (this.currentTag.disabled) {
                        // check if current tag has become or is disabled, if it is, then skip step.
                        this.skipStep();
                    }
                    else {
                        this.showStep();
                    }
                }
            }
        };
        FlowManager.prototype.showStep = function () {
            var _this = this;
            if (this.stopped)
                return;
            cf.ConversationalForm.illustrateFlow(this, "dispatch", cf.FlowEvents.FLOW_UPDATE, this.currentTag);
            this.currentTag.refresh();
            setTimeout(function () {
                _this.eventTarget.dispatchEvent(new CustomEvent(cf.FlowEvents.FLOW_UPDATE, {
                    detail: {
                        tag: _this.currentTag,
                        ignoreExistingTag: _this.ignoreExistingTags,
                        step: _this.step,
                        maxSteps: _this.maxSteps
                    }
                }));
            }, 0);
        };
        FlowManager.STEP_TIME = 1000;
        return FlowManager;
    }());
    cf.FlowManager = FlowManager;
})(cf || (cf = {}));

/// <reference path="ui/inputs/UserTextInput.ts"/>
/// <reference path="ui/chat/ChatList.ts"/>
/// <reference path="logic/FlowManager.ts"/>
/// <reference path="ui/ProgressBar.ts"/>
/// <reference path="logic/EventDispatcher.ts"/>
/// <reference path="form-tags/Tag.ts"/>
/// <reference path="form-tags/CfRobotMessageTag.ts"/>
/// <reference path="form-tags/TagGroup.ts"/>
/// <reference path="form-tags/InputTag.ts"/>
/// <reference path="form-tags/SelectTag.ts"/>
/// <reference path="form-tags/ButtonTag.ts"/>
/// <reference path="data/Dictionary.ts"/>
/// <reference path="parsing/TagsParser.ts"/>
/// <reference path="interfaces/IUserInput.ts"/>
/// <reference path="interfaces/IUserInterfaceOptions.ts"/>
var cf;
(function (cf_1) {
    var ConversationalForm = /** @class */ (function () {
        function ConversationalForm(options) {
            this.version = "2.0.0";
            this.cdnPath = "https://cdn.jsdelivr.net/gh/space10-community/conversational-form@{version}/dist/";
            this.isDevelopment = false;
            this.loadExternalStyleSheet = true;
            this.theme = 'light';
            this.preventAutoAppend = false;
            this.preventAutoStart = false;
            window.ConversationalForm = this;
            this.cdnPath = this.cdnPath.split("{version}").join(this.version);
            if (typeof options.suppressLog === 'boolean')
                ConversationalForm.suppressLog = options.suppressLog;
            if (typeof options.showProgressBar === 'boolean')
                ConversationalForm.showProgressBar = options.showProgressBar;
            if (typeof options.preventSubmitOnEnter === 'boolean')
                this.preventSubmitOnEnter = options.preventSubmitOnEnter;
            if (typeof options.disableSelectPrefill === 'boolean')
                ConversationalForm.disableSelectPrefill = options.disableSelectPrefill;
            if (!ConversationalForm.suppressLog)
                console.log('Conversational Form > version:', this.version);
            if (!ConversationalForm.suppressLog)
                console.log('Conversational Form > options:', options);
            window.ConversationalForm[this.createId] = this;
            // possible to create your own event dispatcher, so you can tap into the events of the app
            if (options.eventDispatcher)
                this._eventTarget = options.eventDispatcher;
            if (!this.eventTarget.cf)
                this.eventTarget.cf = this;
            // set a general step validation callback
            if (options.flowStepCallback)
                this.flowStepCallback = options.flowStepCallback;
            this.isDevelopment = ConversationalForm.illustrateAppFlow = !!document.getElementById("conversational-form-development");
            if (options.loadExternalStyleSheet == false) {
                this.loadExternalStyleSheet = false;
            }
            if (typeof options.theme === 'string')
                this.theme = options.theme;
            if (!isNaN(options.scrollAcceleration))
                cf_1.ScrollController.acceleration = options.scrollAcceleration;
            this.preventAutoStart = options.preventAutoStart;
            this.preventAutoAppend = options.preventAutoAppend;
            if (!options.formEl)
                throw new Error("Conversational Form error, the formEl needs to be defined.");
            this.formEl = options.formEl;
            this.formEl.setAttribute("cf-create-id", this.createId);
            if (options.hideUserInputOnNoneTextInput === true) {
                cf_1.UserInputElement.hideUserInputOnNoneTextInput = true;
            }
            this.submitCallback = options.submitCallback;
            if (this.submitCallback && typeof this.submitCallback === "string") {
                // Must be a string on window, rewritten to avoid unsafe eval() calls
                var fn = window[this.submitCallback];
                this.submitCallback = fn;
            }
            if (this.formEl.getAttribute("cf-no-animation") == "")
                ConversationalForm.animationsEnabled = false;
            if (typeof options.animationsEnabled === 'boolean'
                && options.animationsEnabled === false) {
                ConversationalForm.animationsEnabled = false;
                this.formEl.setAttribute("cf-no-animation", "");
            }
            if (options.preventAutoFocus || this.formEl.getAttribute("cf-prevent-autofocus") == "")
                cf_1.UserInputElement.preventAutoFocus = true;
            this.dictionary = new cf_1.Dictionary({
                data: options.dictionaryData,
                robotData: options.dictionaryRobot,
                userImage: options.userImage,
                robotImage: options.robotImage,
                version: this.version
            });
            this.context = options.context ? options.context : document.body;
            this.tags = options.tags;
            if (options.microphoneInput) {
                // validate the user ..... TODO....
                if (!options.microphoneInput.init || !options.microphoneInput.input) {
                    console.warn("Conversational Form: microphoneInput is not correctly setup", options.microphoneInput);
                    options.microphoneInput = null;
                }
            }
            this.microphoneInputObj = options.microphoneInput;
            // set the ui options
            this.uiOptions = cf_1.Helpers.extendObject(cf_1.UserInterfaceDefaultOptions, options.userInterfaceOptions || {});
            // console.log('this.uiOptions:', this.uiOptions);
            this.options = options;
            this.init();
        }
        Object.defineProperty(ConversationalForm.prototype, "createId", {
            get: function () {
                if (!this._createId) {
                    this._createId = new Date().getTime().toString();
                }
                return this._createId;
            },
            enumerable: false,
            configurable: true
        });
        Object.defineProperty(ConversationalForm.prototype, "eventTarget", {
            get: function () {
                if (!this._eventTarget) {
                    this._eventTarget = new cf_1.EventDispatcher(this);
                }
                return this._eventTarget;
            },
            enumerable: false,
            configurable: true
        });
        ConversationalForm.prototype.init = function () {
            switch (this.theme) {
                case 'dark':
                    this.theme = 'conversational-form-dark.min.css';
                    if (!this.options.robotImage)
                        this.updateDictionaryValue('robot-image', 'robot', "data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='100' cy='100' r='100' fill='%233A3A3C'/%3E%3Crect x='66' y='66' width='68' height='68' fill='%23E5E6EA'/%3E%3C/svg%3E%0A");
                    if (!this.options.userImage)
                        this.updateDictionaryValue('user-image', 'user', "data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='100' cy='100' r='100' fill='%23E5E6EA'/%3E%3Cpath d='M100 55L138.971 122.5H61.0289L100 55Z' fill='%233A3A3C'/%3E%3C/svg%3E%0A");
                    break;
                case 'green':
                    this.theme = 'conversational-form-green.min.css';
                    if (!this.options.robotImage)
                        this.updateDictionaryValue('robot-image', 'robot', "data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='100' cy='100' r='100' fill='%23EEEFF0'/%3E%3Crect x='66' y='66' width='68' height='68' fill='%2300BF75'/%3E%3C/svg%3E%0A");
                    if (!this.options.userImage)
                        this.updateDictionaryValue('user-image', 'user', "data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='100' cy='100' r='100' fill='%2300BF75'/%3E%3Cpath d='M100 55L138.971 122.5H61.0289L100 55Z' fill='%23EEEFF0'/%3E%3C/svg%3E%0A");
                    break;
                case 'blue':
                    this.theme = 'conversational-form-irisblue.min.css';
                    if (!this.options.robotImage)
                        this.updateDictionaryValue('robot-image', 'robot', "data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='100' cy='100' r='100' fill='%23E8E9EB'/%3E%3Crect x='66' y='66' width='68' height='68' fill='%2300C2DF'/%3E%3C/svg%3E%0A");
                    if (!this.options.userImage)
                        this.updateDictionaryValue('user-image', 'user', "data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='100' cy='100' r='100' fill='%2300C2DF'/%3E%3Cpath d='M100 55L138.971 122.5H61.0289L100 55Z' fill='%23E8E9EB'/%3E%3C/svg%3E%0A");
                    break;
                case 'purple':
                    this.theme = 'conversational-form-purple.min.css';
                    if (!this.options.robotImage)
                        this.updateDictionaryValue('robot-image', 'robot', "data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='100' cy='100' r='100' fill='%23EEEFF0'/%3E%3Crect x='66' y='66' width='68' height='68' fill='%235A1DE4'/%3E%3C/svg%3E%0A");
                    if (!this.options.userImage)
                        this.updateDictionaryValue('user-image', 'user', "data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='100' cy='100' r='100' fill='%235A1DE4'/%3E%3Cpath d='M100 55L138.971 122.5H61.0289L100 55Z' fill='%23EEEFF0'/%3E%3C/svg%3E%0A");
                    break;
                case 'red':
                    this.theme = 'conversational-form-red.min.css';
                    if (!this.options.robotImage)
                        this.updateDictionaryValue('robot-image', 'robot', "data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='100' cy='100' r='100' fill='%23E8E9EB'/%3E%3Crect x='66' y='66' width='68' height='68' fill='%23FF3233'/%3E%3C/svg%3E%0A");
                    if (!this.options.userImage)
                        this.updateDictionaryValue('user-image', 'user', "data:image/svg+xml,%3Csvg width='200' height='200' viewBox='0 0 200 200' fill='none' xmlns='http://www.w3.org/2000/svg'%3E%3Ccircle cx='100' cy='100' r='100' fill='%23FF3233'/%3E%3Cpath d='M100 55L138.971 122.5H61.0289L100 55Z' fill='%23E8E9EB'/%3E%3C/svg%3E%0A");
                    break;
                default:
                    this.theme = 'conversational-form.min.css';
            }
            if (this.isDevelopment) {
                // Set path for development
                this.cdnPath = '../build/';
                // strip .min from filename since we do not have minified css in build
                this.theme = this.theme.replace('.min', '');
            }
            if (this.loadExternalStyleSheet) {
                // not in development/examples, so inject production css
                var head = document.head || document.getElementsByTagName("head")[0];
                var style = document.createElement("link");
                var githubMasterUrl = this.cdnPath + this.theme;
                style.type = "text/css";
                style.media = "all";
                style.setAttribute("rel", "stylesheet");
                style.setAttribute("href", githubMasterUrl);
                head.appendChild(style);
            }
            // set context position to relative, else we break out of the box
            var position = window.getComputedStyle(this.context).getPropertyValue("position").toLowerCase();
            if (["fixed", "absolute", "relative"].indexOf(position) == -1) {
                this.context.style.position = "relative";
            }
            // if tags are not defined then we will try and build some tags our selves..
            if (!this.tags || this.tags.length == 0) {
                this.tags = [];
                var fields = [].slice.call(this.formEl.querySelectorAll("input, select, button, textarea, cf-robot-message"), 0);
                for (var i = 0; i < fields.length; i++) {
                    var element = fields[i];
                    if (cf_1.Tag.isTagValid(element)) {
                        // ignore hidden tags
                        this.tags.push(cf_1.Tag.createTag(element));
                    }
                }
            }
            else {
                // tags are manually setup and passed as options.tags.
            }
            // remove invalid tags if they've sneaked in.. this could happen if tags are setup manually as we don't encurage to use static Tag.isTagValid
            var indexesToRemove = [];
            for (var i = 0; i < this.tags.length; i++) {
                var element = this.tags[i];
                if (!element || !cf_1.Tag.isTagValid(element.domElement)) {
                    indexesToRemove.push(element);
                }
            }
            for (var i = 0; i < indexesToRemove.length; i++) {
                var tag = indexesToRemove[i];
                this.tags.splice(this.tags.indexOf(tag), 1);
            }
            if (!ConversationalForm.suppressLog && (!this.tags || this.tags.length == 0)) {
                console.warn("Conversational Form: No tags found or registered.");
            }
            //let's start the conversation
            this.tags = this.setupTagGroups(this.tags);
            this.setupUI();
            return this;
        };
        /**
        * @name updateDictionaryValue
        * set a dictionary value at "runtime"
        *	id: string, id of the value to update
        *	type: string, "human" || "robot"
        *	value: string, value to be inserted
        */
        ConversationalForm.prototype.updateDictionaryValue = function (id, type, value) {
            cf_1.Dictionary.set(id, type, value);
            // if(["robot-image", "user-image"].indexOf(id) != -1){
            // 	this.chatList.updateThumbnail(id == "robot-image", value);
            // }
        };
        ConversationalForm.prototype.getFormData = function (serialized) {
            if (serialized === void 0) { serialized = false; }
            if (serialized) {
                var serialized_1 = {};
                for (var i = 0; i < this.tags.length; i++) {
                    var element = this.tags[i];
                    if (element.value)
                        serialized_1[element.name || "tag-" + i.toString()] = element.value;
                }
                return serialized_1;
            }
            else {
                var formData = new FormData(this.formEl);
                return formData;
            }
        };
        ConversationalForm.prototype.addRobotChatResponse = function (response) {
            this.chatList.createResponse(true, null, response);
        };
        ConversationalForm.prototype.addUserChatResponse = function (response) {
            // add a "fake" user response..
            this.chatList.createResponse(false, null, response);
        };
        ConversationalForm.prototype.stop = function (optionalStoppingMessage) {
            if (optionalStoppingMessage === void 0) { optionalStoppingMessage = ""; }
            this.flowManager.stop();
            if (optionalStoppingMessage != "")
                this.chatList.createResponse(true, null, optionalStoppingMessage);
            this.userInput.onFlowStopped();
        };
        ConversationalForm.prototype.start = function () {
            this.userInput.disabled = false;
            if (!ConversationalForm.suppressLog)
                console.log('option, disabled 3');
            this.userInput.visible = true;
            this.flowManager.start();
        };
        ConversationalForm.prototype.getTag = function (nameOrIndex) {
            if (typeof nameOrIndex == "number") {
                return this.tags[nameOrIndex];
            }
            else {
                // TODO: fix so you can get a tag by its name attribute
                return null;
            }
        };
        ConversationalForm.prototype.setupTagGroups = function (tags) {
            // make groups, from input tag[type=radio | type=checkbox]
            // groups are used to bind logic like radio-button or checkbox dependencies
            var groups = [];
            for (var i = 0; i < tags.length; i++) {
                var tag = tags[i];
                if (tag.type == "radio" || tag.type == "checkbox") {
                    if (!groups[tag.name])
                        groups[tag.name] = [];
                    groups[tag.name].push(tag);
                }
            }
            if (Object.keys(groups).length > 0) {
                for (var group in groups) {
                    if (groups[group].length > 0) {
                        // always build groupd when radio or checkbox
                        // find the fieldset, if any..
                        var isFieldsetValidForCF = function (tag) { return tag && tag.tagName.toLowerCase() !== "fieldset" && !tag.hasAttribute("cf-questions"); };
                        var fieldset = groups[group][0].domElement.parentNode;
                        if (fieldset && fieldset.tagName.toLowerCase() !== "fieldset") {
                            fieldset = fieldset.parentNode;
                            if (isFieldsetValidForCF(fieldset)) {
                                // not a valid fieldset, we only accept fieldsets that contain cf attr
                                fieldset = null;
                            }
                        }
                        var tagGroup = new cf_1.TagGroup({
                            fieldset: fieldset,
                            elements: groups[group]
                        });
                        // remove the tags as they are now apart of a group
                        for (var i = 0; i < groups[group].length; i++) {
                            var tagToBeRemoved = groups[group][i];
                            if (i == 0) // add the group at same index as the the first tag to be removed
                                tags.splice(tags.indexOf(tagToBeRemoved), 1, tagGroup);
                            else
                                tags.splice(tags.indexOf(tagToBeRemoved), 1);
                        }
                    }
                }
            }
            return tags;
        };
        ConversationalForm.prototype.setupUI = function () {
            // start the flow
            this.flowManager = new cf_1.FlowManager({
                cfReference: this,
                flowStepCallback: this.flowStepCallback,
                eventTarget: this.eventTarget,
                tags: this.tags
            });
            this.el = document.createElement("div");
            this.el.id = "conversational-form";
            this.el.className = "conversational-form";
            this.addBrowserTypes(this.el);
            if (ConversationalForm.animationsEnabled)
                this.el.classList.add("conversational-form--enable-animation");
            // add conversational form to context
            if (!this.preventAutoAppend)
                this.context.appendChild(this.el);
            //hide until stylesheet is rendered
            this.el.style.visibility = "hidden";
            var innerWrap = document.createElement("div");
            innerWrap.className = "conversational-form-inner";
            this.el.appendChild(innerWrap);
            // Conversational Form UI
            this.chatList = new cf_1.ChatList({
                eventTarget: this.eventTarget,
                cfReference: this
            });
            innerWrap.appendChild(this.chatList.el);
            this.userInput = new cf_1.UserTextInput({
                microphoneInputObj: this.microphoneInputObj,
                eventTarget: this.eventTarget,
                cfReference: this
            });
            if (ConversationalForm.showProgressBar) {
                var progressBar = new cf_1.ProgressBar(this);
                innerWrap.appendChild(progressBar.el);
            }
            this.chatList.addInput(this.userInput);
            innerWrap.appendChild(this.userInput.el);
            this.onUserAnswerClickedCallback = this.onUserAnswerClicked.bind(this);
            this.eventTarget.addEventListener(cf_1.ChatResponseEvents.USER_ANSWER_CLICKED, this.onUserAnswerClickedCallback, false);
            this.el.classList.add("conversational-form--show");
            if (!this.preventAutoStart)
                this.flowManager.start();
            if (!this.tags || this.tags.length == 0) {
                // no tags, so just show the input
                this.userInput.visible = true;
            }
        };
        /**
        * @name onUserAnswerClicked
        * on user ChatReponse clicked
        */
        ConversationalForm.prototype.onUserAnswerClicked = function (event) {
            var tag = event.detail;
            this.flowManager.editTag(tag);
        };
        ConversationalForm.prototype.addBrowserTypes = function (el) {
            if (navigator.userAgent.indexOf('Firefox') > -1)
                el.classList.add('browser-firefox');
            if (/Edge/.test(navigator.userAgent))
                el.classList.add('browser-edge');
        };
        /**
        * @name addTag
        * Add a tag to the conversation. This can be used to add tags at runtime
        * see examples/formless.html
        */
        ConversationalForm.prototype.addTags = function (tagsData, addAfterCurrentStep, atIndex) {
            if (addAfterCurrentStep === void 0) { addAfterCurrentStep = true; }
            if (atIndex === void 0) { atIndex = -1; }
            var tags = [];
            for (var i = 0; i < tagsData.length; i++) {
                var tagData = tagsData[i];
                if (tagData.tag === "fieldset") {
                    // group ..
                    // const fieldSetChildren: Array<DataTag> = tagData.children;
                    // parse group tag
                    var groupTag = cf_1.TagsParser.parseGroupTag(tagData);
                    for (var j = 0; j < groupTag.children.length; j++) {
                        var tag = groupTag.children[j];
                        if (cf_1.Tag.isTagValid(tag)) {
                            var tagElement = cf_1.Tag.createTag(tag);
                            // add ref for group creation
                            if (!tagElement.name) {
                                tagElement.name = "tag-ref-" + j.toString();
                            }
                            tags.push(tagElement);
                        }
                    }
                }
                else {
                    var tag = tagData.tag === "select" ? cf_1.TagsParser.parseGroupTag(tagData) : cf_1.TagsParser.parseTag(tagData);
                    if (cf_1.Tag.isTagValid(tag)) {
                        var tagElement = cf_1.Tag.createTag(tag);
                        tags.push(tagElement);
                    }
                }
            }
            // map free roaming checkbox and radio tags into groups
            tags = this.setupTagGroups(tags);
            // add new tags to the flow
            this.tags = this.flowManager.addTags(tags, addAfterCurrentStep ? this.flowManager.getStep() + 1 : atIndex);
            //this.flowManager.startFrom ?
        };
        /**
        * @name remapTagsAndStartFrom
        * index: number, what index to start from
        * setCurrentTagValue: boolean, usually this method is called when wanting to loop or skip over questions, therefore it might be usefull to set the value of the current tag before changing index.
        * ignoreExistingTags: boolean, possible to ignore existing tags, to allow for the flow to just "happen"
        */
        ConversationalForm.prototype.remapTagsAndStartFrom = function (index, setCurrentTagValue, ignoreExistingTags) {
            if (index === void 0) { index = 0; }
            if (setCurrentTagValue === void 0) { setCurrentTagValue = false; }
            if (ignoreExistingTags === void 0) { ignoreExistingTags = false; }
            if (setCurrentTagValue) {
                this.chatList.setCurrentUserResponse(this.userInput.getFlowDTO());
            }
            // possibility to start the form flow over from {index}
            for (var i = 0; i < this.tags.length; i++) {
                var tag = this.tags[i];
                tag.refresh();
            }
            this.flowManager.startFrom(index, ignoreExistingTags);
        };
        /**
        * @name focus
        * Sets focus on Conversational Form
        */
        ConversationalForm.prototype.focus = function () {
            if (this.userInput)
                this.userInput.setFocusOnInput();
        };
        ConversationalForm.prototype.doSubmitForm = function () {
            this.el.classList.add("done");
            this.userInput.reset();
            if (this.submitCallback) {
                // remove should be called in the submitCallback
                this.submitCallback(this);
            }
            else {
                // this.formEl.submit();
                // doing classic .submit wont trigger onsubmit if that is present on form element
                // as described here: http://wayback.archive.org/web/20090323062817/http://blogs.vertigosoftware.com/snyholm/archive/2006/09/27/3788.aspx
                // so we mimic a click.
                var button = this.formEl.ownerDocument.createElement('button');
                button.style.display = 'none';
                button.type = 'submit';
                this.formEl.appendChild(button);
                button.click();
                this.formEl.removeChild(button);
                // remove conversational
                this.remove();
            }
        };
        ConversationalForm.prototype.remove = function () {
            if (this.microphoneInputObj) {
                this.microphoneInputObj = null;
            }
            if (this.onUserAnswerClickedCallback) {
                this.eventTarget.removeEventListener(cf_1.ChatResponseEvents.USER_ANSWER_CLICKED, this.onUserAnswerClickedCallback, false);
                this.onUserAnswerClickedCallback = null;
            }
            if (this.flowManager)
                this.flowManager.dealloc();
            if (this.userInput)
                this.userInput.dealloc();
            if (this.chatList)
                this.chatList.dealloc();
            this.dictionary = null;
            this.flowManager = null;
            this.userInput = null;
            this.chatList = null;
            this.context = null;
            this.formEl = null;
            this.tags = null;
            this.submitCallback = null;
            this.el.parentNode.removeChild(this.el);
            this.el = null;
            window.ConversationalForm[this.createId] = null;
        };
        // to illustrate the event flow of the app
        ConversationalForm.illustrateFlow = function (classRef, type, eventType, detail) {
            // ConversationalForm.illustrateFlow(this, "dispatch", FlowEvents.USER_INPUT_INVALID, event.detail);
            // ConversationalForm.illustrateFlow(this, "receive", event.type, event.detail);
            if (detail === void 0) { detail = null; }
            if (ConversationalForm.illustrateAppFlow) {
                var highlight = "font-weight: 900; background: " + (type == "receive" ? "#e6f3fe" : "pink") + "; color: black; padding: 0px 5px;";
                if (!ConversationalForm.suppressLog)
                    console.log("%c** event flow: %c" + eventType + "%c flow type: %c" + type + "%c from: %c" + classRef.constructor.name, "font-weight: 900;", highlight, "font-weight: 400;", highlight, "font-weight: 400;", highlight);
                if (detail)
                    if (!ConversationalForm.suppressLog)
                        console.log("** event flow detail:", detail);
            }
        };
        ConversationalForm.startTheConversation = function (data) {
            var isFormless = !!data.formEl === false;
            var formlessTags;
            var constructorOptions;
            if (isFormless) {
                if (typeof data === "string") {
                    // Formless init w. string
                    isFormless = true;
                    var json = JSON.parse(data);
                    constructorOptions = json.options;
                    formlessTags = json.tags;
                }
                else {
                    // Formless init w. JSON object
                    constructorOptions = data.options;
                    formlessTags = data.tags;
                }
                // formless, so generate the pseudo tags
                var formEl = cf.TagsParser.parseJSONIntoElements(formlessTags);
                constructorOptions.formEl = formEl;
            }
            else {
                // keep it standard
                constructorOptions = data;
            }
            return new cf.ConversationalForm(constructorOptions);
        };
        ConversationalForm.autoStartTheConversation = function () {
            if (cf.ConversationalForm.hasAutoInstantiated)
                return;
            // auto start the conversation
            var formElements = document.querySelectorAll("form[cf-form]");
            // no form elements found, look for the old init attribute
            if (formElements.length === 0) {
                formElements = document.querySelectorAll("form[cf-form-element]");
            }
            var formContexts = document.querySelectorAll("*[cf-context]");
            if (formElements && formElements.length > 0) {
                for (var i = 0; i < formElements.length; i++) {
                    var form = formElements[i];
                    var context = formContexts[i];
                    cf.ConversationalForm.startTheConversation({
                        formEl: form,
                        context: context
                    });
                }
                cf.ConversationalForm.hasAutoInstantiated = true;
            }
        };
        ConversationalForm.animationsEnabled = true;
        ConversationalForm.illustrateAppFlow = true;
        ConversationalForm.suppressLog = true;
        ConversationalForm.showProgressBar = false;
        ConversationalForm.preventSubmitOnEnter = false;
        ConversationalForm.disableSelectPrefill = false;
        ConversationalForm.hasAutoInstantiated = false;
        return ConversationalForm;
    }());
    cf_1.ConversationalForm = ConversationalForm;
})(cf || (cf = {}));
if (document.readyState == "complete") {
    // if document alread instantiated, usually this happens if Conversational Form is injected through JS
    setTimeout(function () { return cf.ConversationalForm.autoStartTheConversation(); }, 0);
}
else {
    // await for when document is ready
    window.addEventListener("load", function () {
        cf.ConversationalForm.autoStartTheConversation();
    }, false);
}

// jquery plugin
(function (factory) {
	try{
		factory(jQuery);
	}catch(e){
		// whoops no jquery..
	}
}(function ($) {
	$.fn.conversationalForm = function (options /* ConversationalFormOptions, see README */) {
		options = options || {};
		if(!options.formEl){
			options.formEl = this[0];
		}

		if(!options.context){
			var formContexts = document.querySelectorAll("*[cf-context]");
			if(formContexts[0]){
				options.context = formContexts[0];
			}
		}

		return new cf.ConversationalForm(options);
	};
}));

// requirejs/amd plugin
(function (root, factory) {
	// from http://ifandelse.com/its-not-hard-making-your-library-support-amd-and-commonjs/#update
	if(typeof define === "function" && define.amd) {
		define(["conversational-form"], function(conversationalform){
			return (root.conversationalform = factory(conversationalform));
		});
	} else if(typeof module === "object" && module.exports) {
		module.exports = (root.conversationalform = factory(require("conversational-form")));
	} else {
		root.conversationalform = factory(cf.ConversationalForm);
	}
	}(window, function(conversationalform) {
		// module code here....
		return cf;
	}
));
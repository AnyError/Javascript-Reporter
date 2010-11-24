AnyError = {};

/*
 * Simple configuration for AnyError.  Turning on the below features will
 * increase the amount of data reported but will also increase the number of
 * request to the server because the url will need to be broken up in order to
 * send all the data.
 */
AnyError.config = {
    send_mime_types : true,
    send_plugins : true,
    send_external_scripts : true,
    send_screen_info: true,
    send_browser_info: true,
    default_extra_data: null,
    server_url :  "http://www.ae.com/api/1/log_error",
    project : "project key not defined",
    max_url_length : 1500
};

/*
 * Use this to attempt to hook any error the the windows on error handler.
 * Not all browser support this.
 */
AnyError.hook_up_window_error = function() {

    var old_on_error = window.onerror;

    window.onerror = function myErrorHandler(errorMsg, url, lineNumber) {
        AnyError.exception_notify({line: lineNumber, message: errorMsg, sourceUrl :url});
        if (old_on_error) {
            return old_on_error(errorMsg, url, lineNumber);
        }
        return false;
    };


    if (typeof(document.onerror) != "undefined") {
        var old_on_error3 = document.onerror;

        document.onerror = function myErrorHandler(errorMsg, url, lineNumber) {
            AnyError.exception_notify({line: lineNumber, message: errorMsg, sourceUrl :url});
            if (old_on_error3) {
                return old_on_error3(errorMsg, url, lineNumber);
            }
            return false;
        }
    }


};

/*
 * Used  to report and exception This will call the notify method but
 * will pre-populate the the exceptions information as a reporting group.
 * The message will be the exception message.
 */
AnyError.exception_notify = function(exception, extra_data) {
    var exception_info = AnyError.exception_info(exception);
    var message = exception_info.message;
    delete exception_info["message"]
    AnyError.notify(message, {"Exception Details" : exception_info}, extra_data);
};


/*
 * Notify the server of the error.
 *
 * Parameters:
 *  message = String message to log
 *  data = Hash of Key value to be sent to server. The key is a grouping of data and the value
 *         should be a hash of key values to report under the grouping.
 */
AnyError.notify = function(message, data, extra_data) {

    try {

        var key = AnyError.config.key;

        if (AnyError.config.send_browser_info) {
            data["Page Data"] = AnyError.page_info();
        }


        if (AnyError.config.send_browser_info) {
            data["Browser"] = AnyError.navigator_info();
        }

        if (AnyError.config.send_mime_types) {
            data["Mime Types"] = AnyError.mime_info();
        }


        if (AnyError.config.send_plugins) {
            data["Plugins"] = AnyError.plugin_info();
        }


        if (AnyError.config.send_screen_info) {
            data["Screen"] = AnyError.screen_info();
        }

        if (AnyError.config.send_external_scripts) {
            data["Scripts"] = AnyError.scripts();
        }

        var default_extra = {};

        AnyError.merge_hash(default_extra, AnyError.config.default_extra_data);

        if (typeof(extra_data) != "undefined") {
            AnyError.merge_hash(default_extra, extra_data);
        }

        data["Extra Data"] = default_extra;


        var url = AnyError.create_url(data, []);
        AnyError.break_up_and_send(message, url);

    }
    catch(badex) {
        alert(badex.message)
    }
};

AnyError.break_up_and_send = function(message, url) {
    var header = "";
    var any_error = AnyError.anyErrorHeader(message);

    if (url.length < AnyError.config.max_url_length) {
        header = AnyError.create_url(any_error, []);
        header = header.substring(1, header.length);

        AnyError.send_message(AnyError.config.server_url + "?" + header + "&" + url);
    }
    else {

        var send_count = 1;
        var splits = url.split("&");
        var tmp_url = "";

        for (var index in splits) {

            tmp_url += "&" + splits[index];

            if (tmp_url.length > AnyError.config.max_url_length) {

                var header = "";
                if (send_count == 1) {
                    header = AnyError.create_url(any_error, []);
                }
                else {
                    header = AnyError.create_url(AnyError.secondHeader(any_error), []);
                }

                header = header.substring(1, header.length);
                AnyError.send_message(AnyError.config.server_url + "?" + header + "&" + tmp_url);
                send_count += 1;
                tmp_url = "";
            }
        }

        if (tmp_url.length !== 0) {
            header = AnyError.create_url(AnyError.secondHeader(any_error), []);
            header = header.substring(1, header.length);
            AnyError.send_message(AnyError.config.server_url + "?" + header + "&" + tmp_url);
        }

    }

};

/*
 * Only one report has to have things that are in the first header.
 */
AnyError.secondHeader = function(current_header) {
    var map = {};
    map.uid = current_header.uid;
    map.project = AnyError.config.project;
    return map;
};


/*
 * Every request needs a unique id. If multiple request with the same id come it
 * they are merged on the server.
 * http://ajaxian.com/archives/uuid-generator-in-javascript
 */
AnyError.generate_request_id = function() {
    var s = [], itoh = '0123456789ABCDEF';

    // Make array of random hex digits. The UUID only has 32 digits in it, but we
    // allocate an extra items to make room for the '-'s we'll be inserting.
    for (var i = 0; i < 36; i++) s[i] = Math.floor(Math.random() * 0x10);

    // Conform to RFC-4122, section 4.4
    s[14] = 4;  // Set 4 high bits of time_high field to version
    s[19] = (s[19] & 0x3) | 0x8;  // Specify 2 high bits of clock sequence

    // Convert to hex chars
    for (var i = 0; i < 36; i++) s[i] = itoh[s[i]];

    // Insert '-'s
    s[8] = s[13] = s[18] = s[23] = '-';

    return s.join('');
};

/*
 * Generate the header part of our request.
 */
AnyError.anyErrorHeader = function(message) {
    var map = {};
    map.message = message;
    map.language = "JavaScript";
    map.project = AnyError.config.project;
    map.uid = AnyError.generate_request_id();
    map.code_version = AnyError.config.code_version;
    return map;
};

/*
 * Create an script element and uses it to report on the error.
 * We uses script as if we used an image then in some browsers the images show as broken
 * until it is loaded. This keeps the reporting hidden from the user.
 */
AnyError.send_message = function(url) {
    var img = document.createElement("script");
    img.src = url;
    if (document.getElementsByTagName("body") == "undefined") {
        document.getElementsByTagName("body")[0].appendChild(img);
    }
    else {
        document.getElementsByTagName("html")[0].appendChild(img);
    }
};

/*
 * Simple function to merge to hashs.
 */
AnyError.merge_hash = function(destination, source) {

    for (var property in source)
        destination[property] = source[property];
    return destination;
};

/*
 * Given a key wrap it with the current parent keys so that we
 * make a document tree.  The way urls are structured determines the way
 * the data is formatted.
 * Example:  key[key1[key2]]]=value means keyone has a child key that has a child of key two.
 * While this is not as nice as json we are doing thing with only gets so we have to structure
 * the data on the url
 */
AnyError.generate_key = function(key, key_array) {
    var result = "";
    var appended = "";

    if (key_array.length !== 0) {
        for (var tkey in key_array) {
            result += key_array[tkey] + "[";
            appended += "]";
        }
        result += key + appended;
        return result;
    }
    else {
        return key;
    }
};

/*
 * Take a hash and break it up in to individual url parameters.
 */
AnyError.create_url = function(data, wrapper_keys) {
    var current_url = "";
    var pad = false;
    if (data.constructor == Array) {
        pad = true;
    }
    for (var key in data) {

        if (data[key] !== null || typeof(data[key]) == undefined) {
            if (typeof(data[key]) == "object") {
                newkeys = wrapper_keys.concat();
                newkeys.push(key);
                current_url += AnyError.create_url(data[key], newkeys)
            }
            else {
                if (data[key] != null && typeof(data[key]) != "undefined") {
                    // If the data for the value is larger than 700 characters we have to truncate it as it may not fit on a url.
                    var new_key = key;
                    if (pad) {
                        new_key = AnyError.pad(key, 3)
                    }
                    current_url += "&" + AnyError.generate_key(new_key, wrapper_keys) + "=" + escape(("" + data[key].toString()).substring(0, 700));
                }
            }

        }
    }
    return current_url;
};

/*
 * Find all the external scripts on the page and report on them.
 */
AnyError.scripts = function() {
    var scripts = [];
    var docscripts = document.getElementsByTagName("script")
    for (var index in docscripts) {
        var script = docscripts[index];
        if (script.src != "" && typeof(script.src) == "string") {
            if (!script.src.match("www.ae.com")) {
//            alert("foudn " + script.src)
                scripts.push(script.src)
            }
        }
    }
    return scripts;
};

/*
 * Here we get the information about the browser.
 */
AnyError.navigator_info = function() {
    var data = {};

    if (navigator.appCodeName) {
        data.appCodeName = navigator.appCodeName;
    }
    if (navigator.appName) {
        data.appName = navigator.appName;
    }
    if (navigator.appVersion) {
        data.appVersion = navigator.appVersion;
    }
    if (navigator.userAgent) {
        data.userAgent = navigator.userAgent;
    }
    if (navigator.language) {
        data.language = navigator.language;
    }

    if (navigator.language) {
        data.language = navigator.language;
    }
    if (navigator.cookieEnabled) {
        data.cookieEnabled = navigator.cookieEnabled;
    }

    if (typeof(navigator.javaEnabled) != "undefined") {
        data.javaEnabled = navigator.javaEnabled();
    }


    if (navigator.systemLanguage) {
        data.systemLanguage = navigator.systemLanguage;
    }
    if (navigator.platform) {
        data.platform = navigator.platform;
    }
    if (navigator.userLanguage) {
        data.userLanguage = navigator.userLanguage;
    }
    return data;

};

/*
 * Because the server stores array indexs as string we need to
 * pad them so they can be sorted correctly.
 */
AnyError.pad = function(number, length) {

    var str = '' + number;
    while (str.length < length) {
        str = '0' + str;
    }

    return str;
};

/*
 * Find all the plugins for the browser.  In some browser this does not work as plugins array
 * is always null,  IE for example.
 */
AnyError.page_info = function() {
    var data = {};
    data.url = window.location.pathname;
    data.host = window.location.hostname;
    data.protocol = window.location.protocol;

    data.params = {};

    var query = window.location.search.substring(1);

    var vars = query.split("&");
    if (vars.length > 1) {
        for (var i = 0; i < vars.length; i++) {
            var pair = vars[i].split("=");
            data.params[ "" + AnyError.pad(i, 3) + " - " + pair[0]  ] = pair[1];
        }
    }
    return data;
};

/*
 * Find all the plugins for the browser.  In some browser this does not work as plugins array
 * is always null,  IE for example.
 */
AnyError.plugin_info = function() {
    var data = [];
    if (AnyError.config.send_plugins && navigator.plugins && navigator.plugins.length > 0) {
        for (var index in navigator.plugins) {
            data.push(navigator.plugins[index].name);
        }
    }
    return data;
}

/*
 * Find all the mimetypes supported by the browser.  In some cases this will give you a hint at the
 * plugins installed.
 */
AnyError.mime_info = function() {
    var data = {};

    if (AnyError.config.send_mime_types && navigator.mimeTypes && navigator.mimeTypes.length > 0) {
        for (var index in navigator.mimeTypes) {
            if (!data[navigator.mimeTypes[index].description]) {
                data[navigator.mimeTypes[index].description] = [];
            }
            data[navigator.mimeTypes[index].description].push(navigator.mimeTypes[index].type);
        }
    }
    return data;
}

/*
 * Get the screen size and color depth.
 */
AnyError.screen_info = function() {
    var data = {};


    if (AnyError.config.send_screen_info && window.screen) {
        if (window.screen.availHeight) {
            data.availHeight = window.screen.availHeight;
        }
        if (window.screen.availWidth) {
            data.availWidth = window.screen.availWidth;
        }
        if (window.screen.colorDepth) {
            data.colorDepth = window.screen.colorDepth;
        }
        if (window.screen.height) {
            data.height = window.screen.height;
        }
        if (window.screen.width) {
            data.width = window.screen.width;
        }
        if (window.screen.pixelDepth) {
            data.pixelDepth = window.screen.pixelDepth;
        }
    }

    return data;
};

/*
 * Attempt to get as much information about the exception as we can.
 * some browsers... IE do not give much info so it might just be the message.
 */
AnyError.exception_info = function(exception) {
    var data = { };


    if (exception.fileName) {
        data.script_url = exception.fileName;
    }
    if (exception.filename) {
        data.script_url = exception.filename;
    }
    if (exception.sourceURL) {
        data.script_url = exception.sourceURL;
    }

    if (exception.message) {
        data.message = exception.message;
    }
    else {
        data.message = exception;
    }

    if (exception.lineNumber) {
        data.lineNumber = exception.lineNumber;
    }
    if (exception.line) {
        data.lineNumber = exception.line;
    }
    if (exception.description) {
        data.description = exception.description;
    }
    if (exception.arguments) {
        data.arguments = exception.arguments;
    }
    if (exception.type) {
        data.type = exception.type;
    }
    if (exception.name) {
        data.name = exception.name;
    }
    else {
        data.name = exception;
    }
//    if (exception.stack) {
    data.stack = AnyError.getStackTrace();
    if (data.stack.length > 4) {
        var newstack = [];
        for (var i = 4; i < data.stack.length; i++) {
            newstack.push(data.stack[i])
        }
        data.stack = newstack;
    }
    else {
        data.stack = [];
    }
//        data.stack = exception.stack;
//    }
    return data;
};


AnyError.getStackTrace = function(options) {
    var ex = (options && options.e) ? options.e : null;
    var guess = options ? !!options.guess : true;

    var p = new AnyError.printStackTrace.implementation();
    var result = p.run(ex);
    return (guess) ? p.guessFunctions(result) : result;
}

AnyError.printStackTrace = {};

AnyError.printStackTrace.implementation = function() {
};

AnyError.printStackTrace.implementation.prototype = {
    run: function(ex) {
        // Use either the stored mode, or resolve it
        var mode = this._mode || this.mode();
        if (mode === 'other') {
            return this.other(arguments.callee);
        } else {
            ex = ex ||
                    (function() {
                        try {
                            var _err = __undef__ << 1;
                        } catch (e) {
                            return e;
                        }
                    })();
            return this[mode](ex);
        }
    },

    /**
     * @return {String} mode of operation for the environment in question.
     */
    mode: function() {
        try {
            var _err = __undef__ << 1;
        } catch (e) {
            if (e['arguments']) {
                return (this._mode = 'chrome');
            } else if (window.opera && e.stacktrace) {
                return (this._mode = 'opera10');
            } else if (e.stack) {
                return (this._mode = 'firefox');
            } else if (window.opera && !('stacktrace' in e)) { //Opera 9-
                return (this._mode = 'opera');
            }
        }
        return (this._mode = 'other');
    },

    /**
     * Given a context, function name, and callback function, overwrite it so that it calls
     * printStackTrace() first with a callback and then runs the rest of the body.
     *
     * @param {Object} context of execution (e.g. window)
     * @param {String} functionName to instrument
     * @param {Function} function to call with a stack trace on invocation
     */
    instrumentFunction: function(context, functionName, callback) {
        context = context || window;
        context['_old' + functionName] = context[functionName];
        context[functionName] = function() {
            callback.call(this, printStackTrace());
            return context['_old' + functionName].apply(this, arguments);
        };
        context[functionName]._instrumented = true;
    },

    /**
     * Given a context and function name of a function that has been
     * instrumented, revert the function to it's original (non-instrumented)
     * state.
     *
     * @param {Object} context of execution (e.g. window)
     * @param {String} functionName to de-instrument
     */
    deinstrumentFunction: function(context, functionName) {
        if (context[functionName].constructor === Function &&
                context[functionName]._instrumented &&
                context['_old' + functionName].constructor === Function) {
            context[functionName] = context['_old' + functionName];
        }
    },

    /**
     * Given an Error object, return a formatted Array based on Chrome's stack string.
     *
     * @param e - Error object to inspect
     * @return Array<String> of function calls, files and line numbers
     */
    chrome: function(e) {
        return e.stack.replace(/^[^\n]*\n/, '').replace(/^[^\n]*\n/, '').replace(/^[^\(]+?[\n$]/gm, '').replace(/^\s+at\s+/gm, '').replace(/^Object.<anonymous>\s*\(/gm, '{anonymous}()@').split('\n');
    },

    /**
     * Given an Error object, return a formatted Array based on Firefox's stack string.
     *
     * @param e - Error object to inspect
     * @return Array<String> of function calls, files and line numbers
     */
    firefox: function(e) {
        return e.stack.replace(/^[^\n]*\n/, '').replace(/(?:\n@:0)?\s+$/m, '').replace(/^\(/gm, '{anonymous}(').split('\n');
    },

    /**
     * Given an Error object, return a formatted Array based on Opera 10's stacktrace string.
     *
     * @param e - Error object to inspect
     * @return Array<String> of function calls, files and line numbers
     */
    opera10: function(e) {
        var stack = e.stacktrace;
        var lines = stack.split('\n'), ANON = '{anonymous}',
                lineRE = /.*line (\d+), column (\d+) in ((<anonymous function\:?\s*(\S+))|([^\(]+)\([^\)]*\))(?: in )?(.*)\s*$/i, i, j, len;
        for (i = 2,j = 0,len = lines.length; i < len - 2; i++) {
            if (lineRE.test(lines[i])) {
                var location = RegExp.$6 + ':' + RegExp.$1 + ':' + RegExp.$2;
                var fnName = RegExp.$3;
                fnName = fnName.replace(/<anonymous function\s?(\S+)?>/g, ANON);
                lines[j++] = fnName + '@' + location;
            }
        }

        lines.splice(j, lines.length - j);
        return lines;
    },

    // Opera 7.x-9.x only!
    opera: function(e) {
        var lines = e.message.split('\n'), ANON = '{anonymous}',
                lineRE = /Line\s+(\d+).*script\s+(http\S+)(?:.*in\s+function\s+(\S+))?/i,
                i, j, len;

        for (i = 4,j = 0,len = lines.length; i < len; i += 2) {
            //TODO: RegExp.exec() would probably be cleaner here
            if (lineRE.test(lines[i])) {
                lines[j++] = (RegExp.$3 ? RegExp.$3 + '()@' + RegExp.$2 + RegExp.$1 : ANON + '()@' + RegExp.$2 + ':' + RegExp.$1) + ' -- ' + lines[i + 1].replace(/^\s+/, '');
            }
        }

        lines.splice(j, lines.length - j);
        return lines;
    },

    // Safari, IE, and others
    other: function(curr) {
        var ANON = '{anonymous}', fnRE = /function\s*([\w\-$]+)?\s*\(/i,
                stack = [], j = 0, fn, args;

        var maxStackSize = 10;
        while (curr && stack.length < maxStackSize) {
            fn = fnRE.test(curr.toString()) ? RegExp.$1 || ANON : ANON;
            args = Array.prototype.slice.call(curr['arguments']);
            stack[j++] = fn + '(' + this.stringifyArguments(args) + ')';
            curr = curr.caller;
        }
        return stack;
    },

    /**
     * Given arguments array as a String, subsituting type names for non-string types.
     *
     * @param {Arguments} object
     * @return {Array} of Strings with stringified arguments
     */
    stringifyArguments: function(args) {
        for (var i = 0; i < args.length; ++i) {
            var arg = args[i];
            if (arg === undefined) {
                args[i] = 'undefined';
            } else if (arg === null) {
                args[i] = 'null';
            } else if (arg.constructor) {
                if (arg.constructor === Array) {
                    if (arg.length < 3) {
                        args[i] = '[' + this.stringifyArguments(arg) + ']';
                    } else {
                        args[i] = '[' + this.stringifyArguments(Array.prototype.slice.call(arg, 0, 1)) + '...' + this.stringifyArguments(Array.prototype.slice.call(arg, -1)) + ']';
                    }
                } else if (arg.constructor === Object) {
                    args[i] = '#object';
                } else if (arg.constructor === Function) {
                    args[i] = '#function';
                } else if (arg.constructor === String) {
                    args[i] = '"' + arg + '"';
                }
            }
        }
        return args.join(',');
    },

    sourceCache: {},

    /**
     * @return the text from a given URL.
     */
    ajax: function(url) {
        var req = this.createXMLHTTPObject();
        if (!req) {
            return;
        }
        req.open('GET', url, false);
        req.setRequestHeader('User-Agent', 'XMLHTTP/1.0');
        req.send('');
        return req.responseText;
    },

    /**
     * Try XHR methods in order and store XHR factory.
     *
     * @return <Function> XHR function or equivalent
     */
    createXMLHTTPObject: function() {
        var xmlhttp, XMLHttpFactories = [
                                        function() {
                                            return new XMLHttpRequest();
                                        }, function() {
            return new ActiveXObject('Msxml2.XMLHTTP');
        }, function() {
            return new ActiveXObject('Msxml3.XMLHTTP');
        }, function() {
            return new ActiveXObject('Microsoft.XMLHTTP');
        }
        ];
        for (var i = 0; i < XMLHttpFactories.length; i++) {
            try {
                xmlhttp = XMLHttpFactories[i]();
                // Use memoization to cache the factory
                this.createXMLHTTPObject = XMLHttpFactories[i];
                return xmlhttp;
            } catch (e) {
            }
        }
    },

    /**
     * Given a URL, check if it is in the same domain (so we can get the source
     * via Ajax).
     *
     * @param url <String> source url
     * @return False if we need a cross-domain request
     */
    isSameDomain: function(url) {
        return url.indexOf(location.hostname) !== -1;
    },

    /**
     * Get source code from given URL if in the same domain.
     *
     * @param url <String> JS source URL
     * @return <String> Source code
     */
    getSource: function(url) {
        if (!(url in this.sourceCache)) {
            this.sourceCache[url] = this.ajax(url).split('\n');
        }
        return this.sourceCache[url];
    },

    guessFunctions: function(stack) {
        for (var i = 0; i < stack.length; ++i) {
            var reStack = /\{anonymous\}\(.*\)@(\w+:\/\/([\-\w\.]+)+(:\d+)?[^:]+):(\d+):?(\d+)?/;
            var frame = stack[i], m = reStack.exec(frame);
            if (m) {
                var file = m[1], lineno = m[4]; //m[7] is character position in Chrome
                if (file && this.isSameDomain(file) && lineno) {
                    var functionName = this.guessFunctionName(file, lineno);
                    stack[i] = frame.replace('{anonymous}', functionName);
                }
            }
        }
        return stack;
    },

    guessFunctionName: function(url, lineNo) {
        try {
            return this.guessFunctionNameFromLines(lineNo, this.getSource(url));
        } catch (e) {
            return 'getSource failed with url: ' + url + ', exception: ' + e.toString();
        }
    },

    guessFunctionNameFromLines: function(lineNo, source) {
        var reFunctionArgNames = /function ([^(]*)\(([^)]*)\)/;
        var reGuessFunction = /['"]?([0-9A-Za-z_]+)['"]?\s*[:=]\s*(function|eval|new Function)/;
        // Walk backwards from the first line in the function until we find the line which
        // matches the pattern above, which is the function definition
        var line = "", maxLines = 10;
        for (var i = 0; i < maxLines; ++i) {
            line = source[lineNo - i] + line;
            if (line !== undefined) {
                var m = reGuessFunction.exec(line);
                if (m && m[1]) {
                    return m[1];
                } else {
                    m = reFunctionArgNames.exec(line);
                    if (m && m[1]) {
                        return m[1];
                    }
                }
            }
        }
        return '(?)';
    }
};



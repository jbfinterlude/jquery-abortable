/*
 * jQuery Abortable Plugin.
 *
 * Written by Omri Yariv.
 *
 * This plugin extends the jQuery promise API by adding an optional abort method on the
 * Exposed object. The abort method will be copied as well to wrapper promises created
 * by jQuery then/when methods.
 *
 */

(function() {
    // Backup the original deferred function.
    var _Deferred = jQuery.Deferred;
    var _when = jQuery.when;

    var pairs = [
        // action, add listener
        [ "resolve", "done"],
        [ "reject", "fail"],
        [ "notify", "progress"]
    ];

    $.Deferred = function(func, options) {
        var defaults = {
            isAbortable: false,
            onAbort: null
        };

        options = $.extend({}, defaults, options);

        var _defResult = _Deferred.call(this, func);

        var _promise = _defResult.promise();

        // Attach an abort method to the promise object.
        if (options.isAbortable) {
            _promise.abort = function() {
                if (jQuery.isFunction(options.onAbort)) {
                    options.onAbort.apply(this, arguments);
                }
                _defResult.reject.apply(this, arguments);
                return _promise;
            };
        }

        // Override 'then' method to chain abort methods as well.
        _promise.then = function( /* fnDone, fnFail, fnProgress */ ) {
            var fns = arguments;

            // If the original promise hasn't been resolved/rejected yet, an abort
            // call should abort it. If it's been resolved and a second promise
            // is now pending, we should abort it as well.
            // The 'master' deferred will be rejected in both cases.
            var abortFunc = _promise.abort;

            var abortThen = function() {
                if (abortFunc) {
                    abortFunc.apply(this, arguments);
                }
            };

            return jQuery.Deferred(function( newDefer ) {
                    jQuery.each( pairs, function( i, pair ) {
                        var action = pair[ 0 ],
                            fn = fns[ i ];
                        // deferred[ done | fail | progress ] for forwarding actions to newDefer
                        _defResult[ pair[1] ]( jQuery.isFunction( fn ) ?
                            function() {
                                var returned = fn.apply( this, arguments );
                                if ( returned && jQuery.isFunction( returned.promise ) ) {
                                    returned.promise(null, true)
                                        .done( newDefer.resolve )
                                        .fail( newDefer.reject )
                                        .progress( newDefer.notify );
                                    abortFunc = returned.abort;
                                } else {
                                    newDefer[ action + "With" ]( this === _promise ? newDefer.promise() : this, [ returned ] );
                                }
                            } :
                            newDefer[ action ]
                        );
                    });
                    fns = null;
                },
                {
                    // The new deferred is abortable as well.
                    isAbortable: true,
                    onAbort: abortThen
                }
            ).promise();

        };

        return _defResult;
    };

    $.when = function() {
        var promises = arguments;
        var ret = _when.apply(this, arguments);
        ret.abort = function() {
            for (var i=0; i<promises.length; i++) {
                var promise = promises[i].promise();
                if (jQuery.isFunction(promise.abort)) {
                    promise.abort.apply(promise, arguments);
                }
            }
        };

        return ret;
    };

})();
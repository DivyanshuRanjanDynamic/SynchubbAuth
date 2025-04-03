const asynchandler = (requestHandler) => {
    return (req, res, next) => {
        Promise.resolve(requestHandler(req, res, next)).catch((error) => next(error));
    };
};

/* asynchandler is a utility function that takes an asynchronous function and returns a function that 
 automatically catches errors and forwards them to the express error handler */
// It eliminates the need for manually wrapping try/catch blocks around async functions in our route handlers.
/* It is a clean and efficient way to manage async errors in an Express.js application.
   The above used functions are higher-order functions */

export { asynchandler };
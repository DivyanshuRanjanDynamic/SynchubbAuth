class ApiError extends Error {
    constructor(statusCode, message) {
      super(message);
      this.statusCode = statusCode;
      this.isOperational = true;  //To differentiate operational errors from programming errors
    }
  }
 
  export default ApiError;

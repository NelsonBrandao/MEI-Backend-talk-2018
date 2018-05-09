'use strict';

const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');

module.exports = function(Customer) {
  Customer.validatesUniquenessOf('email');

  function hashPassword (password) {
    const salt = bcrypt.genSaltSync(10);
    return bcrypt.hashSync(password, salt);
  }

  function comparePassword (hash, password) {
    if (!hash || !password) {
      return Promise.resolve(false);
    }


    return bcrypt.compare(password, hash);
  }

  function createAuthToken (customer) {
    return jwt.sign({ customerId: customer.id }, 'SECRET');
  };

  function decodeToken (authHeader) {
    if (!authHeader) {
      return false;
    }

    const parts = authHeader.split(' ');

    if (parts.length !== 2) {
      return false;
    }

    return jwt.verify(parts[1], 'SECRET');
  }


  Customer.signup = function (credentials, callback) {
    if (!credentials.email || !credentials.password) {
      return callback(new Error('Credentials are invalid'));
    }

    Customer
      .create({ email: credentials.email, password: hashPassword(credentials.password) })
      .then(customer => callback(null, createAuthToken(customer)))
      .catch(error => callback(error))
    ;
  };

  Customer.remoteMethod(
    'signup',
    {
      accepts: { arg: 'credentials', type: 'object', required: true, http: { source: 'body' } },
      returns: { arg: 'accessToken', type: 'object', root: true },
      http: {verb: 'post'},
    }
  );

  Customer.login = function (credentials, callback) {
    if (!credentials.email || !credentials.password) {
      return callback(new Error('Credentials are invalid'));
    }

    Customer.findOne({ where: { email: credentials.email } })
      .then(customer => {
        if (!customer) {
          throw new Error('Credentials are invalid');
        }

        return comparePassword(customer.password, credentials.password)
          .then(isValid => {
            if (!isValid) {
              throw new Error('Credentials are invalid');
            }

            return createAuthToken(customer);
          })
        ;
      })
      .then(customer => callback(null, customer))
      .catch(error => callback(error))
  };

  Customer.remoteMethod(
    'login',
    {
      accepts: { arg: 'credentials', type: 'object', required: true, http: { source: 'body' } },
      returns: { arg: 'accessToken', type: 'object', root: true },
      http: {verb: 'post'},
    }
  );

  Customer.updateFavoriteCoins = function (req, data, callback) {
    const payload = decodeToken(req.headers.authorization);

    if (!payload) {
      return callback(new Error('Authentication is required'));
    }

    Customer.findById(payload.customerId)
      .then(customer => customer.updateAttributes({ favoriteCoins: data.list }))
      .then(customer => callback(null, customer))
      .catch(error => callback(error))
    ;
  };

  Customer.remoteMethod(
    'updateFavoriteCoins',
    {
      accepts: [
        { arg: 'req', type: 'object', http: { source: 'req' } },
        { arg: 'data', type: 'any', required: true, http: { source: 'body' } },
      ],
      returns: { arg: 'accessToken', type: 'object', root: true },
      http: {verb: 'put'},
    }
  );

  Customer.getCustomerCoins = function (req, data, callback) {
    const payload = decodeToken(req.headers.authorization);

    if (!payload) {
      return callback(new Error('Authentication is required'));
    }

    Customer.findById(payload.customerId)
      .then(customer => Customer.app.models.Coin.find({ where: { symbol: { inq: customer.favoriteCoins } } }))
      .then(coins => callback(null, coins))
      .catch(error => callback(error))
    ;
  };

  Customer.remoteMethod(
    'getCustomerCoins',
    {
      accepts: [
        { arg: 'req', type: 'object', http: { source: 'req' } },
        { arg: 'data', type: 'any', required: true, http: { source: 'body' } },
      ],
      returns: { arg: 'accessToken', type: 'object', root: true },
      http: {verb: 'get'},
    }
  );
};

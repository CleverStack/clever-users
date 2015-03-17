var async      = require('async')
  , underscore = require('underscore')
  , passport   = require('passport')
  , util       = require('util');

module.exports = function(config, Controller, Promise, UserService, AccountController, AuthController, Exceptions) {

  var UserController = Controller.extend({
    service: UserService,
    route: '/auth/user/:id/?|/auth/user/:id/:action/?|/auth/users/?|/auth/users/:action/?',
    autoRouting: [

      /**
       * Because we are defining the UserController we have to wrap the middleware call to requiresLogin
       * 
       * @param  {Request}    req  the request object
       * @param  {Response}   res  the response object
       * @param  {Function}   next connect next()
       * @return {Object}          routes object containing settings
       */
      function(req, res, next) {
        return UserController.requiresLogin(config[ 'clever-auth' ].requiresLogin)(req, res, next);
      },

      AccountController.addAccountIdToRequest({
        all             : false,
        listAction      : true,
        getAction       : true,
        postAction      : true,
        putAction       : true,
        deleteAction    : true
      })
    ],

    /**
     * Passport serialize function
     * 
     * @param  {Object}   user The signed on user
     * @param  {Function} done complete the serialization
     * @return {undefined}
     */
    serializeUser: function(user, done) {
      done(null, user);
    },

    /**
     * Passport deserialize function
     * 
     * @param  {Object}   user the signed on user
     * @param  {Function} done complete the deserialization
     * @return {undefined}
     */
    deserializeUser: function(user, done) {
      done(null, user);
    },

    /**
     * Middleware that can be used to define login requirements for actions based on routes
     *
     * Examples:
     *     UserController.requiresPermission()
     *     UserController.requiresPermission(true)
     *     UserController.requiresPermission({
     *         all: true,
     *         getAction: false
     *     })
     * 
     * @param  {Mixed} requiredRoutes undefined, boolean true or false and { getAction: true } are all valid values
     * @return {undefined}
     */
    requiresLogin: function(requiredRoutes) {
      if (typeof requiredRoutes !== 'object') {
        requiredRoutes = {
          all: [ requiredRoutes !== undefined ? requiredRoutes : true ]
        }
      }

      return function(req, res, next) {
        var method          = req.method.toLowerCase()
          , action          = req.params.action ? req.params.action.toLowerCase() : false
          , requiresLogin   = false;

        if (!action && method === 'get' && /^\/[^\/]+\/?$/ig.test(req.url)) {
          action = 'list';
        } else if (/^[0-9a-fA-F]{24}$/.test(action) || !isNaN(action)) {
          action = 'get';
        }

        async.waterfall(
          [
            function routeRequiresLogin(callback) {
              var actionName = (!!action ? action : method) + 'Action';

              if (typeof requiredRoutes[ actionName ] !== 'undefined') {
                if (requiredRoutes[ actionName ] !== null) {
                  if (requiredRoutes[ actionName ] === true) {
                    requiresLogin = true;
                  }
                }
              } else if (typeof requiredRoutes.all !== 'undefined') {
                if (requiredRoutes.all === true) {
                  requiresLogin = true;
                }
              }

              callback(null, requiresLogin);
            },

            function authenticationChecker(requiresLogin, callback) {
              if (requiresLogin === true) {
                if (req.isAuthenticated()) {
                  callback(null);
                } else {
                  callback('User is not authenticated!');
                }
              } else {
                callback(null);
              }
            }
          ],
          function(err) {
            if (err === null) {
              next();
            } else {
              res.send(401, { statusCode: 401, message: err });
            }
          }

       );
      }
    },

    /**
     * Middleware that can be used to define the signed in users administration permission requirements for actions based on routes
     *
     * Examples:
     *     UserController.requiresAdminRights()
     *     UserController.requiresAdminRights(true)
     *     UserController.requiresAdminRights({
     *         all: true,
     *         getAction: false
     *     })
     * 
     * @param  {Mixed} requiredRoutes undefined, boolean true or false and { getAction: true } are all valid values
     * @return {undefined}
     */
    requiresAdminRights: function(requiredRoutes) {
      if (typeof requiredRoutes !== 'object') {
        requiredRoutes = {
          all: [ requiredRoutes !== undefined ? requiredRoutes : true ]
        }
      }

      return function(req, res, next) {
        var method          = req.method.toLowerCase()
          , action          = req.params.action
          , requiresLogin   = false;

        if (!action && method === 'get' && /^\/[^\/]+\/?$/ig.test(req.url)) {
          action = 'list';
        } else if (/^[0-9a-fA-F]{24}$/.test(action) || !isNaN(action)) {
          action = 'get';
        }

        async.waterfall(
          [
            function routeRequiresLogin(callback) {
              var actionName = (!!action ? action : method) + 'Action';

              if (typeof requiredRoutes[ actionName ] !== 'undefined') {
                if (requiredRoutes[ actionName ] !== null) {
                  if (requiredRoutes[ actionName ] === true) {
                    requiresLogin = true;
                  }
                }
              } else if (typeof requiredRoutes.all !== 'undefined') {
                if (requiredRoutes.all === true) {
                  requiresLogin = true;
                }
              }

              callback(null, requiresLogin);
            },

            function authenticationChecker(requiresLogin, callback) {
              if (requiresLogin === true) {
                if (req.isAuthenticated() && !!req.session.passport.user.hasAdminRight) {
                  callback(null);
                } else {
                  callback('User does not have administration rights!');
                }
              } else {
                callback(null);
              }
            }
          ],
          function(err) {
            if (err === null) {
              next();
            } else {
              res.send(401, { statusCode: 401, message: err });
            }
          }

       );
      }
    },
    
    /**
     * Middleware that can be used on any single route to check that password recovery data has been provided
     * 
     * @param  {Request}    req  the request object
     * @param  {Response}   res  the response object
     * @param  {Function}   next connect next()
     * @return {undefined}
     */
    checkPasswordRecoveryData: function (req, res, next) {
      var userId = req.body.userId
        , password = req.body.password
        , token = req.body.token

      if (!userId) {
        return res.send(400, 'Invalid user Id.');
      }

      if (!token) {
        return res.send(400, 'Invalid Token.');
      }

      if (!password) {
        return res.send(400, 'Password does not match the requirements');
      }

      next();
    }
  },
  {
    postAction: function () {
      var findOptions
        , promise;

      if (!!this.param('id')) {
        this.action = 'putAction';
        return this.putAction.apply(this, arguments);
      }

      if ((findOptions = this.getOptionsForService()) && Object.keys(findOptions.where).length) {
        promise = UserService.findOrCreate(findOptions, this.req.body, {});
      } else {
        promise = UserService.create(this.req.body, {});
      }

      return promise.then(this.proxy(function(user) {
        AuthController.authenticate.apply(this, [ null, user ]);
      }));
    },

    putAction: function () {
      var findOptions
        , promise;

      if (!this.param('id')) {
        this.action = 'postAction';
        return this.postAction.apply(this, arguments);
      }

      if ((findOptions = this.getOptionsForService()) && Object.keys(underscore.omit(findOptions.where, 'id')).length) {
        promise = UserService.findAndUpdate(findOptions, underscore.omit(this.req.body, 'id', 'createdAt', 'updatedAt'), {});
      } else {
        findOptions.where.id = this.param('id');
        promise = UserService.update(underscore.omit(this.req.body, 'id', 'createdAt', 'updatedAt'), findOptions);
      }

      return promise.then(this.proxy(function(user) {
        AuthController.updateSession.apply(this, [ user ]);
      }));
    },

    deleteAction: function() {
      return this._super().then(this.proxy(function() {
        if (this.req.params.id === this.req.user.id) {
          AuthController.signOut.apply(this, arguments);
        } else {
          this.handleServiceMessage.apply(this, arguments);
        }
      }));
    },

    /**
     * Handler for verifying users emails, as well as the initial "Sign-Up" userState
     * @return {Promise}
     */
    verifyAction: function(req) {
      var data   = req.query
        , userId = req.params.user_id;

      UserService
      .find({ where: { id: userId } })
      .then(this.proxy('handleVerify', data))
      .then(this.proxy(function(user) {
        this.res.redirect(util.format('/auth/user/%d/', user.id));
      }))
      .catch(this.proxy('handleServiceMessage'));
    },

    /**
     * Helper function for the verifyAction, here we check the validity of the link provided (token) as well
     * as making sure the user hasn't already verified this email address before
     * 
     * @param  {RequestParams} data the request params as prepared by verifyAction
     * @param  {UserModel}     user the model for the user requesting to verify
     * @return {Promise}
     */
    handleVerify: function(data, user) {
      return new Promise(function(resolve, reject) {
        if (!user) {
          reject({ statusCode: 403, message: 'Error: Invalid link.' }, 403);
        } else if (!!user.verified) {
          reject(new Exceptions.AlreadyVerified({ statusCode: 400, message: 'Error: You have already activated your email address.' }));
        } else {
          return UserService.generatePasswordResetHash(data, user, 'email-verification')
            .then(this.proxy("verifyEmail", data, user))
            .then(resolve)
            .catch(reject);
        }
      }
      .bind(this));
    },

    /**
     * Helper function for the verifyAction, and this function is called directly after handleVerify and 
     * here we check the validity of the provided token, then update the emailState and userState as required.
     * 
     * @param  {RequestParams} data    the request params as prepared by verifyAction
     * @param  {UserModel}     user    the model for the user requesting to verify
     * @param  {String}        hashobj the generated token based hash to compare
     * @return {Promise}
     */
    verifyEmail: function(data, user, hashobj) {
      return new Promise(function(resolve, reject) {
        if (!hashobj.hash && hashobj.statuscode) {
          reject(hashobj);
        } else if (data.token !== hashobj.hash) {
          reject({ statusCode: 400, message: 'Error: Invalid token.' }, 400);
        } else {
          user.confirmed = true;
          user
            .save()
            .then(this.proxy(AuthController.authenticate, null, user, function(err, user) {
              if (!err) {
                resolve(user);
              } else {
                reject(err);
              }
            }))
            .catch(reject);
        }
      }
      .bind(this));
    },

    /**
     * Handler function to resend the user's email verification requests, in case they had not recieved
     * them in their inbox, this function is also called after postAction() to send the inital verification email.
     * 
     * @param  {Request} req the incoming request
     * @return {Promise}
     */
    resendAction: function(req) {
      return UserService.resendConfirmationEmail(
        req.user ? req.user.id : null,
        req.params.user_id,
        req.body.email || req.query.email
      );
    },

    /**
     * Handler function to send a password recovery email to the user, in case they have fogotten it.
     * 
     * @param  {Request} req the incoming request
     * @return {Promise}
     */
    forgottenPasswordAction: function(req) {
      return UserService.sendRecoveryEmail(
        req.user ? req.user.id : null,
        req.params.user_id,
        req.body.email || req.query.email
      ).then(function() {
        return {
          statusCode: 200,
          message: util.format("An email has been sent to %s.", req.params.email)
        }
      })
    },

    /**
     * Handler function to reset a users password after receiving a password recovery email,
     * after updating the users password we need to authenticate the user.
     * 
     * @param  {Request} req the incoming request
     * @return {Promise}
     */
    resetPasswordAction: function(req) {
      var userId      = req.params.user_id
        , password    = req.body.password || req.query.password
        , token       = req.body.token || req.query.token
        , email       = req.query.email || req.body.email;

      return new Promise(function(resolve, reject) {
        if (!password) {
          return reject(new Exceptions.InvalidData('Please enter your new password.'));
        }

        UserService.find({
          where: {
            id: userId
          }
        })
        .then(function(user) {
          return UserService.generatePasswordResetHash({email: email}, user);
        })
        .then(function(recoveryData) {
          if(recoveryData.hash !== token) {
            return reject({ statusCode: 400, message: 'Error: Invalid token.' }, 400);
          } else {
            recoveryData.user.hashPassword(password);

            recoveryData.user.save().then(this.proxy( AuthController.authenticate, null, recoveryData.user, function(err, results) {
              if (!err) {
                resolve(results);
              } else {
                reject(err);
              }
            }));
          }
        }.bind(this))
        .catch(reject);
      }
      .bind(this));
    }

  });

  passport.serializeUser(UserController.callback('serializeUser'));
  passport.deserializeUser(UserController.callback('deserializeUser'));

  return UserController;  
};

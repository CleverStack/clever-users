var crypto      = require('crypto')
  , Promise     = require('bluebird')
  , moment      = require('moment')
  , config      = require('config')
  , utils       = require('utils')
  , ejsRenderer = utils.ejsRenderer
  , mailer      = utils.mailer;

module.exports = function(Service, UserModel, Exceptions) {
  return Service.extend({

    model: UserModel,

    create: function(data, options) {
      var create = this._super;

      options = options || {};

      return new Promise(function(resolve, reject) {
        UserModel
          .find({
            where: {
              email: data.email
            }
          }, options)
          .then(function(user) {
            if (user !== null) {
              return reject(new Exceptions.DuplicateModel('Email ' + data.email + ' already exists'));
            }

            // Prepare the data
            data.username = data.username || data.email;
            data.active = data.active !== undefined ? data.active : true;
            data.password = crypto.createHash('sha1').update(data.password ? data.password : Math.random().toString(36).slice(-14)).digest('hex');

            if (data.confirmed === undefined || data.confirmed === false) {
              data.confirmed = false;

              var tplData = {
                action   : 'account_confirm',
                tplTitle : 'Email Confirmation'
              };

              var unconfirmedUser;

              create.apply(this, [data, options])
                .then(this.proxy(function(usr) {
                  unconfirmedUser = usr;
                  return this.generatePasswordResetHash(usr, tplData);
                }))
                .then(this.proxy('mailPasswordRecoveryToken'))
                .then(function() {
                  resolve(unconfirmedUser);
                })
                .catch(reject);
              
            } else {
              create.apply(this, [data, options])
                .then(resolve)
                .catch(reject);
            }
          }.bind(this))
          .catch(reject);

      }
      .bind(this));
    },

    update: function(data, options) {
      if (data.new_password) {
        data.password = crypto.createHash('sha1').update(data.new_password).digest('hex');
        delete data.new_password;
      }

      return this._super.apply(this, [data, options]);
    },

    //tested
    authenticate: function (credentials, options) {
      options = options || {};

      return new Promise(function(resolve, reject) {
        UserModel
          .find({
            where: {
              email:      credentials.email,
              password:   credentials.password
            }
          }, options)
          .then(function(user) {
            if (!!user && !!user.id) {
              if (!!user.confirmed && !!user.active) {
                user.accessedAt = Date.now();
                return user.save(options);
              } else {
                reject(new Exceptions.UserNotActive("Login is not active for " + user.email + '.'));
              }
            } else {
              reject(new Exceptions.InvalidLoginCredentials("Invalid login credentials."));
            }
          })
          .then(resolve)
          .catch(reject);
      });
    },

    generatePasswordResetHash: function (user, tplData) {
      return new Promise(function(resolve) {
        var md5 = crypto.createHash('md5').update(user.createdAt + user.updatedAt + user.password + user.email + 'recover', 'utf8');

        resolve({
          hash        : md5.digest('hex'),
          expTime     : moment.utc().add('hours', 8).valueOf(),
          tpl         : !user.confirmed ? 'newUser.ejs' : 'passwordRecovery.ejs',
          action      : !user.confirmed ? 'account/confirm' : 'resetPassword',
          subject     : !user.confirmed ? 'CleverStack User Confirmation' : 'Password Recovery',
          user        : user,

          tplData     : tplData || {}
        });
      });
    },

    sendRecoveryEmail: function(email) {
      return new Promise(function(resolve, reject) {
        if (!email) {
          return reject(new Exceptions.InvalidData('You must provide your email address'));
        }

        UserModel
        .findByEmail(email)
        .then(this.proxy(function(user) {
          if (!user) {
            return reject(new Exceptions.ModelNotFound("User doesn't exist"));
          }

          user.failedPasswordAttempts = 0;
          return user.save();
        }))
        .then(this.proxy(function(user) {
          return this.generatePasswordResetHash(user);
        }))
        .then(this.proxy('mailPasswordRecoveryToken'))
        .then(resolve)
        .catch(reject);
      }
      .bind(this));
    },

    mailPasswordRecoveryToken: function(recoveryData) {
      var url             = config['clever-users'].appUrl
        , link            = url + '/' + recoveryData.action + '?u=' + recoveryData.user.id + '&t=' + recoveryData.hash + '&n=' + encodeURIComponent(recoveryData.user.fullName)
        , payload         = { to: recoveryData.user.email }

      payload.to          = recoveryData.user.email;
      payload.from        = 'account@charmux.com';
      payload.fromname    = 'Charm UX';
      payload.text        = ( recoveryData.tplData.action === 'account/confirm' ) ? "Please click on the link below to activate your account\n " + link : "Please click on the link below to enter a new password\n " + link;
      payload.subject     = recoveryData.subject;

      var templateData = {
        link            : link,
        companyLogo     : 'https://app.charmux.com/images/1266e831.Charm-UX-app-logo.png',
        companyName     : 'Charm UX',
        subject         : recoveryData.subject,
        tplTitle        : recoveryData.tplData.tplTitle || 'Password Recovery',
        firstName       : recoveryData.user.firstName,
        lastName        : recoveryData.user.lastName,
        email           : recoveryData.user.email,
        user            : recoveryData.user
      };

      templateData.firstName      = recoveryData.user.firstName;
      templateData.email          = recoveryData.user.email;
      templateData.user           = recoveryData.user;

      return new Promise(function(resolve, reject) {
        ejsRenderer('modules/clever-users/views/' + recoveryData.tpl, templateData)
          .then(function(html) {
            payload.html = html;
            return mailer.send(payload);
          })
          .then(function() {
            if (!recoveryData.user.confirmed) {
              return this.emailAdminWhenNewUser(templateData);
            } else {
              resolve();
            }
          }.bind(this))
          .then(resolve)
          .catch(reject);
      }
      .bind(this));
    },

    emailAdminWhenNewUser: function(user) {
      return new Promise( function( resolve, reject ) {
        var adminPayload = {
          to          : 'account@charmux.com',
          from        : 'account@charmux.com',
          fromname    : 'CharmUX Alert',
          text        : 'A new user registered: ' + user.firstName + ' ' + user.lastName,
          subject     : 'CharmUX new user: ' + user.email + ' ' + user.firstName + ' ' + user.lastName
        };
        mailer.send(adminPayload).then(resolve).catch(reject);
      });
    },

    resendAccountConfirmation: function(userId, tplData) {
      var service = this;
      
      return new Promise(function(resolve, reject) {
        UserModel
          .find(userId)
          .then(function (user) {

            if (!user) {
              resolve({ statuscode: 403, message: "User doesn't exist" });
              return;
            }

            if (user.confirmed) {
              resolve({ statuscode: 400, message: user.email + ' , has already confirmed the account' });
              return;
            }

            tplData.userFirstName = user.firstName;
            tplData.userEmail = user.email;

            service.generatePasswordResetHash(user, tplData)
              .then(service.mailPasswordRecoveryToken)
              .then(function () {
                resolve({ statuscode: 200, message: 'A confirmation link has been resent' });
              })
              .catch(reject);

          })
          .catch(resolve);
      });

    }

  });
};

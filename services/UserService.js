module.exports = function(Service, Promise, Exceptions, config, utils, UserModel) {
  var crypto      = require('crypto')
    , moment      = require('moment')
    , ejsRenderer = utils.ejsRenderer
    , mailer      = utils.mailer
    , emailConfig = config['clever-users'].email;

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
    authenticate: function(credentials, options) {
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

    generatePasswordResetHash: function(user, tplData) {
      return new Promise(function(resolve) {
        var md5  = crypto.createHash('md5').update(user.createdAt + user.updatedAt + user.password + user.email + 'recover', 'utf8')
          , type = !user.confirmed ? 'confirmation' : 'recovery';

        resolve({
          hash        : md5.digest('hex'),
          expTime     : moment.utc().add('hours', 8).valueOf(),
          tpl         : emailConfig.template[type],
          action      : !user.confirmed ? 'account/confirm' : 'resetPassword',
          subject     : emailConfig.subject[type],
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
      var payload = {
        to       : recoveryData.user.email,
        from     : emailConfig.fromEmail,
        fromname : emailConfig.fromName,
        subject  : recoveryData.subject
      };

      var link = emailConfig.appUrl + '/' + recoveryData.action + '?u=' + recoveryData.user.id + '&t=' + recoveryData.hash + '&n=' + encodeURIComponent(recoveryData.user.fullName)
      if (recoveryData.tplData.action === 'account/confirm') {
        payload.text = "Please click on the link below to activate your account\n " + link;
      } else {
        payload.text = "Please click on the link below to enter a new password\n " + link;
      }

      var templateData = {
        link        : link,
        companyLogo : emailConfig.companyLogo,
        companyName : emailConfig.companyName,
        subject     : recoveryData.subject,
        tplTitle    : recoveryData.tplData.tplTitle || 'Password Recovery',
        firstName   : recoveryData.user.firstName,
        lastName    : recoveryData.user.lastName,
        email       : recoveryData.user.email,
        user        : recoveryData.user
      };

      var templatePath = 'modules/clever-users/views/' + recoveryData.tpl;

      return ejsRenderer(templatePath, templateData).then(function(html) {
        payload.html = html;
        return mailer.send(payload);
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

var crypto     = require('crypto');

module.exports = function(Model, config) {
  return Model.extend( 'User',
  {
    type            : config['clever-users'].driver || 'ORM',
    timeStampable   : true,
    softDeleteable  : true
  },
  {
    id: {
      type          : Number,
      primaryKey    : true,
      autoIncrement : true
    },
    // title           : String,
    username: {
      type          : String,
      length        : 255,
      unique        : true,
      required      : true
    },
    email: {
      type          : String,
      length        : 255,
      unique        : true,
      required      : true,
      validate: {
        isEmail     : true
      }
    },
    password        : String,
    firstName       : String,
    lastName        : String,
    phone           : String,
    confirmed: {
      type          : Boolean,
      default       : false
    },
    active: {
      type          : Boolean,
      default       : true
    },
    hasAdminRight: {
      type          : Boolean,
      default       : false
    },
    accessedAt      : Date,

    getHashToken: function() {
      this.debug('Getting a reset token (Hash)');
      return crypto.createHash('md5').update(this.createdAt + this.updatedAt + this.password + this.email + 'recover', 'utf8').digest('hex');
    },

    /**
     * This function will hash the provided "password" and save it on this model
     * 
     * @param  {String} password The unhashed password the user is setting
     * @return {void}
     */
    hashPassword: function(password) {
      this.debug('Hashing users password');
      this.password = crypto.createHash('sha1').update(password).digest('hex');
    },

    toJSON: function() {
      var user = this._super();
      user.fullName = user.firstName + ' ' + user.lastName;
      return user;
    }
  });
};

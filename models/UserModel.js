module.exports = function(Model, config) {
  return Model.extend('User',
  {
    type: config['clever-users'].driver || 'ORM',
    softDeletable   : true,
    timeStampable   : true
  },
  {
    id: {
      type          : Number,
      primaryKey    : true,
      autoIncrement : true
    },
    title           : String,
    username: {
      type          : String,
      length        : 191,
      unique        : true,
      required      : true
    },
    email: {
      type          : String,
      length        : 191,
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

    /**
     * Virtual Getter, will be outputted to JSON as "fullName"
     * @return {String} the users firstName and lastName combined as "fullName"
     */
    getFullName: function() {
      return this.firstName + ' ' + this.lastName;
    }
  })
}

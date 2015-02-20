module.exports = function( Model, config ) {
    return Model.extend( 'User',
    {
        type:               config[ 'clever-users' ].driver || 'ORM',
        softDeletable:      true,
        timeStampable:      true
    },
    {
        id: {
            type:           Number,
            primaryKey:     true,
            autoIncrement:  true
        },
        title: {
            type:           String
        },
        username: {
            type:           String,
            length:         191,
            unique:         true,
            required:       true
        },
        email: {
            type:           String,
            length:         191,
            unique:         true,
            required:       true,
            validate: {
                isEmail:    true
            }
        },
        password: {
            type:           String
        },
        firstName: {
            type:           String,
            allowNull:      true
        },
        lastName: {
            type:           String,
            allowNull:      true
        },
        phone: {
            type:           String,
            allowNull:      true
        },
        confirmed: {
            type:           Boolean,
            default:        false
        },
        active: {
            type:           Boolean,
            default:        true
        },
        hasAdminRight: {
            type:           Boolean,
            default:        false
        },
        accessedAt:         Date,

        getFullName: function() {
            return !!this.firstname || !!this.lastname ? [ this.firstname, this.lastname ].join( ' ' ) : '';
        }
    });
};
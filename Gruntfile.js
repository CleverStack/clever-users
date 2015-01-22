'use strict';

var fs      = require( 'fs' )
  , path    = require( 'path' )
  , crypto  = require( 'crypto' )
  , _       = require( 'underscore' );

module.exports = function( grunt ) {
    var defaultConfig   = require( path.join( __dirname, 'config', 'default.json' ) )
      , configFile      = null
      , config          = {}
      , usersSeedFile   = path.join( process.cwd(), 'modules', 'clever-users', 'schema', 'seedData.json' )
      , seedFile        = path.join( process.cwd(), 'schema', 'seedData.json' )
      , seed            = {}
      , foundUser       = false;

    if ( fs.existsSync( usersSeedFile ) ) {
        _.extend( seed, require( usersSeedFile ) );
    }

    if ( fs.existsSync( seedFile ) ) {
        _.extend( seed, require( seedFile ) );
    }

    return [{
        prompt: {
            usersSeedDataPrompt: {
                options: {
                    questions: [
                        {
                            config: 'cleverauth.username',
                            type: 'input',
                            message: 'Default Username',
                            default: 'default',
                        },
                        {
                            type: 'confirm',
                            config: 'cleverauth.overwrite',
                            message: 'Overwrite existing user with the same username?',
                            when: function( answers ) {
                                seed.UserModel.forEach( function( user, i ) {
                                    if ( user.username === answers[ 'cleverauth.username' ] ) {
                                        if ( foundUser === false ) {
                                            foundUser = [];
                                        }
                                        foundUser.push( i );
                                    }
                                });

                                return foundUser !== false;
                            }
                        },
                        {
                            config: 'cleverauth.password',
                            type: 'password',
                            message: 'Default Users Password',
                            default: 'clever',
                            when: function( answers ) {
                                if ( answers[ 'cleverauth.overwrite' ] === undefined || answers[ 'cleverauth.overwrite' ] === true ) {
                                    return true;
                                } else {
                                    grunt.fail.fatal( 'Username `' + answers[ 'cleverauth.username' ] + '` already exists in seed data and you chose not to overwrite it!' );
                                }
                            }
                        },
                        {
                            config: 'cleverauth.email',
                            type: 'input',
                            message: 'Default Users Email',
                            default: 'default@cleverstack.io'
                        },
                        {
                            type: 'confirm',
                            config: 'cleverauth.overwrite',
                            message: 'Overwrite existing user with the same email?',
                            when: function( answers ) {
                                if ( answers[ 'cleverauth.overwrite' ] === true ) {
                                    return false;
                                } else {
                                    seed.UserModel.forEach( function( user, i ) {
                                        if ( user.email === answers[ 'cleverauth.email' ] ) {
                                            foundUser = i;
                                        }
                                    });

                                    return foundUser !== false;
                                }
                            }
                        },
                        {
                            config: 'cleverauth.firstname',
                            type: 'input',
                            message: 'Default Users Firstname',
                            default: 'Clever',
                            when: function( answers ) {
                                if ( answers[ 'cleverauth.overwrite' ] === undefined || answers[ 'cleverauth.overwrite' ] === true ) {
                                    return true;
                                } else {
                                    grunt.fail.fatal( 'Email `' + answers[ 'cleverauth.email' ] + '` already exists in seed data and you chose not to overwrite it!' );
                                }
                            }
                        },
                        {
                            config: 'cleverauth.lastname',
                            type: 'input',
                            message: 'Default Users Lastname',
                            default: 'User',
                        },
                        {
                            config: 'cleverauth.phone',
                            type: 'input',
                            message: 'Default Users Phone Number',
                            default: ''
                        },
                        {
                            config: 'cleverauth.hasAdminRight',
                            type: 'confirm',
                            message: 'Default User has admin rights'
                        },
                        {
                            config: 'cleverauth.confirmed',
                            type: 'confirm',
                            message: 'Default User has confirmed their email'
                        },
                        {
                            config: 'cleverauth.active',
                            type: 'confirm',
                            message: 'Default User has an active account'
                        }
                    ]
                }
            }
        }
    }, function( grunt ) {
        grunt.loadNpmTasks( 'grunt-prompt' );
        
        grunt.registerTask( 'prompt:cleverUsersSeed', [ 'prompt:usersSeedDataPrompt', 'usersSeedData' ] );
        grunt.registerTask( 'usersSeedData', 'Creates seed data for clever-users module', function() {
            var conf = grunt.config( 'cleverauth' );

            // Make sure the required array is there
            seed.UserModel = seed.UserModel || [];

            // Remove the user if there is a duplicate
            if ( foundUser !== false ) {
                foundUser.forEach( function( user ) {
                    conf.associations = seed.UserModel[ user ].associations || {};
                    seed.UserModel.splice( user, 1 );
                });
            }
            delete conf.overwrite;

            // Update the password hash
            conf.password = crypto.createHash( 'sha1' ).update( conf.password ).digest( 'hex' );

            seed.UserModel.push( conf );

            fs.writeFileSync( seedFile, JSON.stringify( seed, null, '  ' ) );
            fs.writeFileSync( authSeedFile, JSON.stringify( {}, null, '  ' ) );

            console.log( 'You should run `grunt db clever-auth` to rebase and seed this data in your database...' );
        });
    }];
};
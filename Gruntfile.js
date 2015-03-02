module.exports = function(grunt) {
  'use strict';

  var fs            = require('fs')
    , path          = require('path')
    , crypto        = require('crypto')
    , underscore    = require('underscore')
    , config        = require('config')
    , moduleSeedFile = path.resolve(path.join(__dirname, 'schema', 'seedData.json'))
    , moduleSeedData = {}
    , seedDataDefaults    = underscore.clone(config[ 'clever-users' ].seedDataPromptDefaults)
    , projectSeedFile      = path.join(process.cwd(), 'schema', 'seedData.json')
    , seedData          = {}
    , foundUser     = false;

  if (fs.existsSync(moduleSeedFile)) {
    moduleSeedData   = require(moduleSeedFile);
    underscore.extend(seedData, moduleSeedData);
  }

  if (fs.existsSync(projectSeedFile)) {
    underscore.extend(seedData, require(projectSeedFile));
  }

  seedData.UserModel = seedData.UserModel || [];

  return [{
    prompt: {
      usersSeedDataPrompt: {
        options: {
          questions: [
            {
              config: 'cleverusers.username',
              type: 'input',
              message: 'Default Username',
              default: seedDataDefaults.username,
            },
            {
              type: 'confirm',
              config: 'cleverusers.overwrite',
              message: 'Overwrite existing user with the same username?',
              when: function(answers) {
                seedData.UserModel.forEach(function(user, i) {
                  if (user.username === answers[ 'cleverusers.username' ]) {
                    if (foundUser === false) {
                      foundUser = [];
                    }
                    foundUser.push(i);
                  }
                });

                return foundUser !== false;
              }
            },
            {
              config: 'cleverusers.password',
              type: 'password',
              message: 'Default Users Password',
              default: seedDataDefaults.password,
              when: function(answers) {
                if (answers[ 'cleverusers.overwrite' ] === undefined || answers[ 'cleverusers.overwrite' ] === true) {
                  return true;
                } else {
                  grunt.fail.fatal('Username `' + answers[ 'cleverusers.username' ] + '` already exists in seed data and you chose not to overwrite it!');
                }
              }
            },
            {
              config: 'cleverusers.email',
              type: 'input',
              message: 'Default Users Email',
              default: seedDataDefaults.email
            },
            {
              type: 'confirm',
              config: 'cleverusers.overwrite',
              message: 'Overwrite existing user with the same email?',
              when: function(answers) {
                if (answers[ 'cleverusers.overwrite' ] === true) {
                  return false;
                } else {
                  seedData.UserModel.forEach(function(user, i) {
                    if (user.email === answers[ 'cleverusers.email' ]) {
                      foundUser = i;
                    }
                  });

                  return foundUser !== false;
                }
              }
            },
            {
              config: 'cleverusers.firstName',
              type: 'input',
              message: 'Default Users Firstname',
              default: foundUser ? foundUser.firstName : (seedDataDefaults.firstName || ''),
              when: function(answers) {
                if (answers[ 'cleverusers.overwrite' ] === undefined || answers[ 'cleverusers.overwrite' ] === true) {
                  return true;
                } else {
                  grunt.fail.fatal('Email `' + answers[ 'cleverusers.email' ] + '` already exists in seed data and you chose not to overwrite it!');
                }
              }
            },
            {
              config: 'cleverusers.lastName',
              type: 'input',
              message: 'Default Users Lastname',
              default: foundUser ? foundUser.lastName : (seedDataDefaults.lastName || ''),
            },
            {
              config: 'cleverusers.phone',
              type: 'input',
              message: 'Default Users Phone Number',
              default: foundUser ? foundUser.phone : (seedDataDefaults.phone || ''),
            },
            {
              config: 'cleverusers.hasAdminRight',
              type: 'confirm',
              message: 'Default User has admin rights'
            },
            {
              config: 'cleverusers.confirmed',
              type: 'confirm',
              message: 'Default User has confirmed their email'
            },
            {
              config: 'cleverusers.active',
              type: 'confirm',
              message: 'Default User has an active account'
            }
          ]
        }
      }
    }
  }, function(grunt) {
    grunt.loadNpmTasks('grunt-prompt');
    
    grunt.registerTask('prompt:cleverUsersSeed', [ 'prompt:usersSeedDataPrompt', 'usersSeedData' ]);
    grunt.registerTask('usersSeedData', 'Creates seed data for clever-users module', function() {
      var conf = grunt.config('cleverusers');

      // Make sure the required array is there
      seedData.UserModel = seedData.UserModel || [];

      // Remove the user if there is a duplicate
      if (foundUser !== false) {
        foundUser.forEach(function(user) {
          if (seedData.UserModel[ user ].associations) {
            conf.associations = seedData.UserModel[ user ].associations;
          }
          seedData.UserModel.splice(user, 1);
        });
      }
      delete conf.overwrite;

      // Update the password hash
      conf.password = crypto.createHash('sha1').update(conf.password).digest('hex');

      seedData.UserModel.push(conf);

      fs.writeFileSync(projectSeedFile, JSON.stringify(seedData, null, '  '));
      delete moduleSeedData.UserModel;
      fs.writeFileSync(moduleSeedFile, JSON.stringify(moduleSeedData, null, '  '));

      console.log('You should run `grunt db` to rebase and seed this data in your database...');
    });
  }];
};

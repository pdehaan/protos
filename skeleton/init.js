
function Initialize(app) {

  app.usersModel.new({user: 'ernie', pass: 'abcd1234'}, function(err, user) {
    console.exit([err, user]);
  });

}

module.exports = Initialize;
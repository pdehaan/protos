#!/usr/bin/env node

/*
 * Stops the node inspector
 */
 
var path = require('path'),
    child_process = require('child_process'),
    inspector = path.resolve(__dirname, '../node_modules/node-inspector/bin/inspector.js'),
    cmd;

if (path.existsSync(inspector)) {

  child_process.exec('ps aux | grep node', function(err, stdout, stderr) {
    if (err) {
      if (err.code == 2) console.log('\n' + stderr)
      else console.log('\nUnable to start node-inspector.\n');
    }
    else if (stdout.indexOf(inspector) > 0) {
     var pid, line, match,
         lines = stdout.split(/\n/g);
     
     for (var i=0; i < lines.length; i++) {
       line = lines[i].trim();
       if (line.indexOf(inspector) > 0) {
         match = line.match(/^(.*?)(\s+)(\d+)/);
         if (match) {
           pid = parseInt(match[3], 10);
           child_process.exec('kill -9 ' + pid, function(err, stdout, stderr) {
             if (err) {
               console.log(err)
             } else if (stdout.length === 0) {
               console.log('\nNode Inspector has been stopped.\n');
             } else {
               console.log(stdout);
             }
           });
         }
       }
     }
    } else {
      console.log('\nNode Inspector is not running.\n');
    }
  });
  
} else {
  
  console.log("\nRun `npm install` to start using node-inspector.\n");
  
}
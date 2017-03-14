"use strict";

var path = require("path");
var fs = require("fs");
var minify = require("jsonminify");
var vue_beautify = require("js-beautify").html;

// Older versions of node have `existsSync` in the `path` module, not `fs`. Meh.
fs.existsSync = fs.existsSync || path.existsSync;
path.sep = path.sep || "/";

// The source file to be formate, original source's path and some options.
var tempPath = process.argv[2] || "";
var filePath = process.argv[3] || "";
var userFolder = process.argv[4] || "";
var pluginFolder = path.dirname(__dirname);
var sourceFolder = path.dirname(filePath);
var options = { vue: {}};

var jsbeautifyrcPath;

// Try and get some persistent options from the plugin folder.
if (fs.existsSync(jsbeautifyrcPath = pluginFolder + path.sep + ".vuebeautifyrc")) {
  setOptions(jsbeautifyrcPath, options);
}

// When a JSBeautify config file exists in the same directory as the source
// file, any directory above, or the user's home folder, then use that
// configuration to overwrite the default prefs.
var sourceFolderParts = path.resolve(sourceFolder).split(path.sep);

var pathsToLook = sourceFolderParts.map(function(value, key) {
  return sourceFolderParts.slice(0, key + 1).join(path.sep);
});

// Start with the current directory first, then with the user's home folder, and
// end with the user's personal sublime settings folder.
pathsToLook.reverse();
pathsToLook.push(getUserHome());
pathsToLook.push(userFolder);

pathsToLook.filter(Boolean).some(function(pathToLook) {
  if (fs.existsSync(jsbeautifyrcPath = path.join(pathToLook, ".vuebeautifyrc"))) {
    setOptions(jsbeautifyrcPath, options);
    return true;
  }
});

// Dump some diagnostics messages, parsed out by the plugin.
console.log("Using formatter options: " + JSON.stringify(options, null, 2));

// Read the source file and, when complete, beautify the code.
fs.readFile(tempPath, "utf8", function(err, data) {
  if (err) {
    return;
  }

  // Mark the output as being from this plugin.
  console.log("*** VUEFormatter output ***");

  if (isVUE(filePath, data)) {
    console.log(vue_beautify(data, options["vue"]));
  }
});

// Some handy utility functions.

function isTrue(value) {
  return value == "true" || value == true;
}

function getUserHome() {
  return process.env.HOME || path.join(process.env.HOMEDRIVE, process.env.HOMEPATH) || process.env.USERPROFILE;
}

function parseJSON(file) {
  try {
    return JSON.parse(minify(fs.readFileSync(file, "utf8")));
  } catch (e) {
    console.log("Could not parse JSON at: " + file);
    return {};
  }
}

function setOptions(file, optionsStore) {
  var obj = parseJSON(file);

  for (var key in obj) {
    var value = obj[key];

    // Options are defined as an object for each format, with keys as prefs.
    if (key != "vue") {
      continue;
    }
    for (var pref in value) {
      // Special case "true" and "false" pref values as actually booleans.
      // This avoids common accidents in .vuebeautifyrc json files.
      if (value == "true" || value == "false") {
        optionsStore[key][pref] = isTrue(value[pref]);
      } else {
        optionsStore[key][pref] = value[pref];
      }
    }
  }
}

// Checks if a file type is allowed by regexing the file name and expecting a
// certain extension loaded from the settings file.
function isTypeAllowed(type, path) {
  var allowedFileExtensions = options[type]["allowed_file_extensions"] || {
    "vue": ["vue"]
  }[type];
  for (var i = 0, len = allowedFileExtensions.length; i < len; i++) {
    if (path.match(new RegExp("\\." + allowedFileExtensions[i] + "$", "i"))) {
      return true;
    }
  }
  return false;
}

function isVUE(path, data) {
  // If file unsaved, check if first non-whitespace character is &lt;
  if (path == "?") {
    return data.match(/^\s*</);
  }
  return isTypeAllowed("vue", path);
}

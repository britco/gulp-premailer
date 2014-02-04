/*jslint node: true, white: true */

'use strict';

var fs = require('fs');
var path = require('path');
var gutil = require('gulp-util');
var through = require('through2');
var spawn = require('win-spawn');
var tempWrite = require('temp-write');
var dargs = require('dargs');
var which = require('which');

module.exports = function (options) {
	options = options || {};
	var passedArgs = dargs(options, ['bundleExec']);
	var bundleExec = options.bundleExec;

	try {
		which.sync('premailer');
	} catch (err) {
		throw new gutil.PluginError('gulp-premailer', 'You need to have Ruby and Premailer installed and in your PATH for this task to work.');
	}
	
	return through.obj(function (file, enc, cb) {
		var self = this;

		if (file.isNull() || path.basename(file.path)[0] === '_') {
			this.push(file);
			return cb();
		}

		if (file.isStream()) {
			this.emit('error', new gutil.PluginError('gulp-premailer', 'Streaming not supported'));
			return cb();
		}

		tempWrite(file.contents, path.extname(file.path), function (err, tempFile) {
			if (err) {
				self.emit('error', new gutil.PluginError('gulp-premailer', err));
				self.push(file);
				return cb();
			}
			
			var cp = spawn('premailer', [tempFile]);

			cp.on('error', function (err) {
				self.emit('error', new gutil.PluginError('gulp-premailer', err));
				self.push(file);
				return cb();
			});

			var errors = '';
			cp.stderr.setEncoding('utf8');
			cp.stderr.on('data', function (data) {
				errors += data;
			});

			cp.stdout.on('data', function (data) {
				console.log('stdout: ' + data);
				console.log(gutil.replaceExtension(file.path, '-inline.html'));
				console.log(path.dirname(file.path));
				self.push(new gutil.File({
					base: path.dirname(file.path),
					path: gutil.replaceExtension(file.path, '-inline.html'),
					contents: data
				}));
				cb();
			});

			cp.on('close', function (code) {
				if (code === 127) {
					self.emit('error', new gutil.PluginError('gulp-premailer', 'You need to have Ruby and Premailer installed and in your PATH for this task to work.'));
					self.push(file);
					return cb();
				}

				if (errors) {
					self.emit('error', new gutil.PluginError('gulp-premailer', '\n' + errors.replace(tempFile, file.path).replace('Use --trace for backtrace.\n', '')));
					self.push(file);
					return cb();
				}

				if (code > 0) {
					self.emit('error', new gutil.PluginError('gulp-premailer', 'Exited with error code ' + code));
					self.push(file);
					return cb();
				}
			});
		});
	});
};

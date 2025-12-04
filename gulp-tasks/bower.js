//var gulp = require('gulp');
var bower = require('gulp-bower');

global.gulp.task('bower', function(done) {
	return bower({
		cwd: "./"
	})
	.on('end', done)
	.on('error', done);
});
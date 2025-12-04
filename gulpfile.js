global.gulp = require('gulp');
var fs = require('fs');
var livereload = require('./gulp-tasks/node_modules/gulp-livereload');
var { Server, config } = require('karma');

var package = JSON.parse(fs.readFileSync('gulp-tasks/package.json'));

// include task files
require("./gulp-tasks/styles");
require("./gulp-tasks/scripts");
require("./gulp-tasks/images");
require("./gulp-tasks/bower");
require("./gulp-tasks/documentation");

//options
var rootPath = "./";

var srcFolder = rootPath + 'src/';
global.srcFolder = srcFolder;

var buildFolder = rootPath + 'build/';
global.buildFolder = buildFolder;

var distFolder = rootPath + 'dist/';
global.distFolder = distFolder;

var tasks = ['bower', 'scripts-form-build', 'sass-form-build', 'copy-images'];
var distTasks = tasks.concat(['karma-tests']);

// Watch Files For Changes
global.gulp.task('watch', global.gulp.series(tasks, function(done) {
	livereload.listen();

	console.log("Watch task started — development");

	global.gulp.watch(srcFolder + '/images/**/*', global.gulp.series('copy-images'));

	global.gulp.watch(srcFolder + '/scripts/**/*.ts', global.gulp.series('typescript-form'));
	global.gulp.watch(srcFolder + '/scripts/cf/**/*.js', global.gulp.series('scripts-form-build'));

	global.gulp.watch(srcFolder + '/styles/**/*.scss', global.gulp.series('sass-form'));

	global.gulp.watch(srcFolder + '../docs/**/*.twig', global.gulp.series('documentation'));
	global.gulp.watch(srcFolder + '../docs/**/*.scss', global.gulp.series('documentationScss'));

	done();
}));

global.gulp.task('karma-tests', async function (done) {
	try {
		const parsedConfig = await config.parseConfig(
			__dirname + '/karma.conf.js',
			{ singleRun: true },
			{ promiseConfig: true, throwErrors: true }
		);
		const server = new Server(parsedConfig, done);
		server.start();
	} catch (err) {
		done(err);
	}
});

// Default tasks
global.gulp.task('default', global.gulp.series('watch'));
global.gulp.task('build', global.gulp.series(tasks));
global.gulp.task('dist', global.gulp.series(distTasks));

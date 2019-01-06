// Load Grunt
module.exports = function (grunt) {
    grunt.initConfig({
        pkg: grunt.file.readJSON('package.json'),
        webfont: {
        	icons: {
        		src: '_src/icons/*.svg',
        		dest: 'assets/'
        	}
        },
    });
// Load Grunt plugins
grunt.loadNpmTasks('grunt-webfont');

// Register Grunt tasks
grunt.registerTask('default', ['webfont',]);
};

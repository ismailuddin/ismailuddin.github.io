$(document).ready(function(){
    $('.open-card').on('click', function () {
        $('> i', this).toggleClass('closeCard');
        $('#hideme').toggle();
    });

    if ($('.background').css('display') != 'none') {
        particlesJS.load('background', 'assets/particles-config.json');
    }
});

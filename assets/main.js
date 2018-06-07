$(document).ready(function(){
    $('.open-card').on('click', function () {
        $('> i', this).toggleClass('closeCard');
        $('#hideme').toggle();
    });

    var particles = Particles.init({
        selector: '.background',
        color: '#000051',
        sizeVariations: 10,
        connectParticles: true
    });
});

$(function () {
  const INPUT = new Image(),
        CVS = $('#output').get(0),
        CTX = CVS.getContext('2d'),
        PROG_BAR = $('#map-progress'),
        scale = (num, in_min, in_max, out_min, out_max) => {
          return (num - in_min) * (out_max - out_min) / (in_max - in_min) + out_min;
        };

  var AUTO_UPDATE = $('#input-auto-update').is(':checked'),
      DELAY = $('#input-update-delay').val() * 1000,
      LOADING = false,
      PIX = [],
      IMG, SRC, FILENAME, WIDTH, HEIGHT;

  let time = Date.now();

  CTX.setPixel = function (x, y, c) {
    if (typeof(c) !== 'undefined') {
      this.fillStyle = c;
    }
    return this.fillRect(x, y, 1, 1);
  };

  const run = function (src) {
    LOADING = true;
    PROG_BAR.val(0).html('0%').show();
    // $('#submit-download').prop('disabled', true)
                         // .parent().addClass('ui-state-disabled');
    uploadImage(src).then(function () {
      drawContours().then(function () {
        PROG_BAR.hide();
        LOADING = false;
        // $('#submit-download').prop('disabled', false)
                             // .parent().removeClass('ui-state-disabled');
        console.log('Done!');
      });
    });
  };

  const uploadImage = function (src) {
    let deferred = $.Deferred();

    if (src === false || src === SRC) return deferred.resolve();

    console.log('Uploading...');

    INPUT.onload = function () {
      WIDTH = CVS.width = this.width;
      HEIGHT = CVS.height = this.height;
      CTX.clearRect(0, 0, WIDTH, HEIGHT);
      CTX.drawImage(this, 0, 0);
      PIX = CTX.getImageData(0, 0, WIDTH, HEIGHT).data;
      IMG = this;
      deferred.resolve();
    };

    if (src) {
      INPUT.src = SRC = src;
      FILENAME = SRC.split('/').pop();
    } else {
      let reader = new FileReader(),
          file = $('#input-file').get(0).files[0];
      reader.onload = function (event) {
        INPUT.src = SRC = event.target.result;
      }
      reader.readAsDataURL(file);
      FILENAME = file.name;
    }

    return deferred;
  };

  const drawContours = function () {
    let deferred = $.Deferred();

    console.log('Generating...');

    const MAP = [],
          LOWEST = $('#input-elev-min').val() * 1,
          HIGHEST = $('#input-elev-max').val() * 1,
          OFFSET = HIGHEST - LOWEST,
          STEP = Math.min($('#input-step').val() * 1, OFFSET),
          DIVISIONS = $('#input-count').val() * 1,
          INCR = STEP / DIVISIONS,
          COLOR = $('#input-step-color').val(),
          COLOR_DIVISIONS = $('#input-count-color').val(),
          COLOR_SEA = $('#input-sea-color').val(),
          CLEAR = $('#input-transparent').is(':checked'),
          defers = [];
    let num = 0;

    $('#input-step').attr('max', OFFSET);
    $('#input-step').attr('value', STEP);

    if (CLEAR) {
      CTX.clearRect(0, 0, WIDTH, HEIGHT);
    } else {
      CTX.drawImage(IMG, 0, 0);
    }

    for (let x = 0; x < WIDTH; ++x) {
      MAP[x] = [];
      for (let y = 0; y < HEIGHT; ++y) {
        let i = (WIDTH * y + x) * 4,
            r = PIX[i],
            g = PIX[i+1],
            b = PIX[i+2],
            luma = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255,
            val = luma * OFFSET + LOWEST;
        MAP[x][y] = Math.ceil(val / INCR) * INCR;
      }
    }

    for (let y = 0; y < HEIGHT; ++y) {
      defers.push($.Deferred());
    }

    for (let y = 0; y < HEIGHT; ++y) {
      setTimeout(function () {

        for (let x = 0; x < WIDTH; ++x) {
          for (let i = 0; i < 4; ++i) {
            let px = x - Math.cos(i * Math.PI / 2),
                py = y - Math.sin(i * Math.PI / 2);
            if (typeof(MAP[px]) === 'undefined' || typeof(MAP[px][py]) === 'undefined') {
              continue;
            }
            let c1 = MAP[x][y],
                c2 = MAP[px][py],
                col = COLOR;
            if (c1 >= c2) continue;
            if ((c1 / STEP) % 1 === 0) col = COLOR_DIVISIONS;
            if (c1 === 0) col = COLOR_SEA;
            CTX.setPixel(x, y, col);
            if (col !== COLOR) CTX.setPixel(px, py, col);
            break;
          }
        }

        let perc = 100 * ++num / HEIGHT;
        PROG_BAR.val(perc)
                .html(Math.floor(perc) + '%');

        defers[y].resolve();
      }, 0);
    }

    $.when(...defers).done(deferred.resolve);

    return deferred;
  };


  run('img/heightmap.png');


  $(document)
    .on('input change', 'input[type!="file"]', function () {
      time = Date.now();
      if (!AUTO_UPDATE || LOADING) return;
      if (!DELAY) return run(false);
      setTimeout(function () {
        if (!AUTO_UPDATE) return;
        if (Date.now() >= time + DELAY) return run(false);
      }, DELAY);
    });
  $('#input-auto-update').on('input change', function () {
    AUTO_UPDATE = $(this).is(':checked');
  });
  $('#input-update-delay').on('input change', function () {
    DELAY = $(this).val() * 1000;
    $('#delay-unit-plural').css('opacity', DELAY !== 1000 ? 1 : 0);
  });
  $('#submit-update').on('click', function () {
    run(false);
  });
  $('#input-file').on('change', function () {
    let file = $(this).get(0).files[0].type,
        valid = file.split('/')[0] === 'image';
    $('#submit-upload').prop('disabled', !valid)
                       .parent().toggleClass('ui-state-disabled', !valid);
  });
  $('#submit-upload').on('click', function () {
    run();
  });
  $('#submit-download').on('click', function () {

    let lnk = document.createElement('a'),
        e;

    lnk.download = FILENAME.split('.').slice(0,-1).join('.') + '-contour.png';

    lnk.href = CVS.toDataURL('image/png;base64');

    if (document.createEvent) {
      let prop = [
            'click',
            true, true,
            window,
            0, 0, 0, 0, 0,
            false, false, false, false,
            0,
            null
          ];
      e = document.createEvent('MouseEvents');
      e.initMouseEvent(...prop);

      lnk.dispatchEvent(e);
    } else if (lnk.fireEvent) {
      lnk.fireEvent('onclick');
    }
  });
});

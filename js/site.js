function normalizeImagePath(path) {
  return path.replace(/^\/+/, '').split('/');
}

function firstCategoryWord(fileName) {
  var base = fileName.replace(/\.[^/.]+$/, '');
  return base.split(/[^A-Za-z0-9]+/)[0] || base;
}

function prettyCategoryName(category) {
  return category.charAt(0).toUpperCase() + category.slice(1);
}

function prettyAlbumName(rawAlbumName) {
  return rawAlbumName.replace(/_/g, ' ');
}

function buildAlbumMap(files) {
  var albums = {};

  files.forEach(function(path) {
    var parts = normalizeImagePath(path);
    if (parts.length < 3) return;

    var album = parts[1];
    var fileName = parts[parts.length - 1];
    var categoryKey = firstCategoryWord(fileName).toLowerCase();

    if (!albums[album]) {
      albums[album] = {
        items: [],
        categories: {}
      };
    }

    albums[album].items.push(path);
    albums[album].categories[categoryKey] = true;
  });

  return albums;
}

function initHomePage() {
  var grid = document.getElementById('albums-grid');
  var files = window.galleryFiles;
  var albumMeta = window.albumMeta || {};

  if (!grid || !Array.isArray(files)) return;

  var albumMap = buildAlbumMap(files);
  var albums = Object.keys(albumMap).sort();

  if (!albums.length) {
    grid.innerHTML = '<p class="empty-state">No albums found in the images folder.</p>';
    return;
  }

  albums.forEach(function(albumName) {
    var album = albumMap[albumName];
    var meta = albumMeta[albumName] || {};
    var card = document.createElement('a');
    card.className = 'album-card';
    card.href = meta.url || '#';

    var categoryCount = Object.keys(album.categories).length;

    card.innerHTML =
      '<h3 class="album-title">' + (meta.name || prettyAlbumName(albumName)) + '</h3>' +
      '<p class="album-meta">' + album.items.length + ' photos</p>' +
      '<p class="album-meta">' + categoryCount + ' categories</p>';

    grid.appendChild(card);
  });
}

function groupAlbumCategories(files) {
  var categories = {};

  files.forEach(function(path) {
    var parts = normalizeImagePath(path);
    var fileName = parts[parts.length - 1] || '';
    var categoryKey = firstCategoryWord(fileName).toLowerCase();

    if (!categories[categoryKey]) {
      categories[categoryKey] = {
        label: prettyCategoryName(categoryKey),
        items: []
      };
    }

    categories[categoryKey].items.push(path);
  });

  return categories;
}

function formatFileName(path) {
  var parts = normalizeImagePath(path);
  return parts[parts.length - 1] || path;
}

function formatFileType(path) {
  var fileName = formatFileName(path);
  var segments = fileName.split('.');
  return segments.length > 1 ? segments[segments.length - 1].toUpperCase() : 'Unknown';
}

function createPhotoModal() {
  return {
    root: document.getElementById('photo-modal'),
    image: document.getElementById('photo-modal-image'),
    imageWrap: document.querySelector('.photo-modal__image-wrap'),
    closeButton: document.getElementById('photo-modal-close'),
    toggleButton: document.getElementById('photo-modal-toggle'),
    metaResolution: document.getElementById('meta-resolution'),
    metaFocal: document.getElementById('meta-focal'),
    metaAperture: document.getElementById('meta-aperture')
  };
}

function getExifByteOrder(view, tiffStart) {
  var marker = String.fromCharCode(view.getUint8(tiffStart), view.getUint8(tiffStart + 1));
  if (marker === 'II') return true;
  if (marker === 'MM') return false;
  return null;
}

function parseExifIfd(view, tiffStart, ifdOffset, littleEndian) {
  var values = {};
  if (!ifdOffset || tiffStart + ifdOffset >= view.byteLength) return values;

  var count = view.getUint16(tiffStart + ifdOffset, littleEndian);
  for (var i = 0; i < count; i++) {
    var entryOffset = tiffStart + ifdOffset + 2 + i * 12;
    if (entryOffset + 12 > view.byteLength) break;

    var tag = view.getUint16(entryOffset, littleEndian);
    var type = view.getUint16(entryOffset + 2, littleEndian);
    var itemCount = view.getUint32(entryOffset + 4, littleEndian);
    var valueOffsetRaw = view.getUint32(entryOffset + 8, littleEndian);

    var typeSizeMap = { 1: 1, 2: 1, 3: 2, 4: 4, 5: 8, 7: 1, 9: 4, 10: 8 };
    var typeSize = typeSizeMap[type] || 0;
    if (!typeSize) continue;

    var totalBytes = typeSize * itemCount;
    var dataOffset = totalBytes <= 4 ? (entryOffset + 8) : (tiffStart + valueOffsetRaw);
    if (dataOffset + totalBytes > view.byteLength) continue;

    if (type === 3 && itemCount >= 1) {
      values[tag] = view.getUint16(dataOffset, littleEndian);
      continue;
    }

    if (type === 4 && itemCount >= 1) {
      values[tag] = view.getUint32(dataOffset, littleEndian);
      continue;
    }

    if (type === 5 && itemCount >= 1) {
      var numerator = view.getUint32(dataOffset, littleEndian);
      var denominator = view.getUint32(dataOffset + 4, littleEndian);
      if (denominator !== 0) {
        values[tag] = numerator / denominator;
      }
      continue;
    }

    if (type === 10 && itemCount >= 1) {
      var sn = view.getInt32(dataOffset, littleEndian);
      var sd = view.getInt32(dataOffset + 4, littleEndian);
      if (sd !== 0) {
        values[tag] = sn / sd;
      }
    }
  }

  return values;
}

function parseJpegExif(arrayBuffer) {
  var view = new DataView(arrayBuffer);
  if (view.byteLength < 4 || view.getUint16(0, false) !== 0xFFD8) return null;

  var offset = 2;
  while (offset + 4 < view.byteLength) {
    if (view.getUint8(offset) !== 0xFF) break;
    var marker = view.getUint8(offset + 1);

    if (marker === 0xD9 || marker === 0xDA) break;

    var size = view.getUint16(offset + 2, false);
    if (size < 2 || offset + 2 + size > view.byteLength) break;

    if (marker === 0xE1) {
      var exifHeader = String.fromCharCode(
        view.getUint8(offset + 4),
        view.getUint8(offset + 5),
        view.getUint8(offset + 6),
        view.getUint8(offset + 7)
      );

      if (exifHeader === 'Exif') {
        var tiffStart = offset + 10;
        var littleEndian = getExifByteOrder(view, tiffStart);
        if (littleEndian === null) return null;

        var firstIfdOffset = view.getUint32(tiffStart + 4, littleEndian);
        var ifd0 = parseExifIfd(view, tiffStart, firstIfdOffset, littleEndian);
        var exifIfdPointer = ifd0[0x8769];
        var exifIfd = parseExifIfd(view, tiffStart, exifIfdPointer, littleEndian);

        return {
          focalLength: exifIfd[0x920A] || null,
          fNumber: exifIfd[0x829D] || null,
          apertureValue: exifIfd[0x9202] || null
        };
      }
    }

    offset += 2 + size;
  }

  return null;
}

function formatFNumber(fNumber, apertureValue) {
  if (typeof fNumber === 'number' && isFinite(fNumber)) {
    return 'f/' + (Math.round(fNumber * 10) / 10).toFixed(1);
  }

  if (typeof apertureValue === 'number' && isFinite(apertureValue)) {
    var converted = Math.pow(2, apertureValue / 2);
    return 'f/' + (Math.round(converted * 10) / 10).toFixed(1);
  }

  return '—';
}

function loadExifDetails(src) {
  return fetch(src)
    .then(function(response) {
      if (!response.ok) return null;
      return response.arrayBuffer();
    })
    .then(function(buffer) {
      if (!buffer) return null;
      return parseJpegExif(buffer);
    })
    .catch(function() {
      return null;
    });
}

function setModalFitMode(modal, isFit) {
  if (!modal.root || !modal.toggleButton) return;

  if (isFit) {
    modal.root.classList.add('photo-modal--fit');
    modal.toggleButton.textContent = 'Original size';
  } else {
    modal.root.classList.remove('photo-modal--fit');
    modal.toggleButton.textContent = 'Fit to screen';
  }
}

function openPhotoModal(modal, photo, albumName) {
  if (!modal.root || !modal.image) return;

  setModalFitMode(modal, true);
  modal.metaResolution.textContent = 'Loading...';
  modal.metaFocal.textContent = '—';
  modal.metaAperture.textContent = '—';

  modal.image.onload = function() {
    modal.metaResolution.textContent = modal.image.naturalWidth + ' × ' + modal.image.naturalHeight;
  };
  modal.image.src = photo.src;

  if (modal.imageWrap) {
    modal.imageWrap.scrollTop = 0;
    modal.imageWrap.scrollLeft = 0;
  }

  modal.root.hidden = false;
  modal.root.setAttribute('data-src', photo.src);
  document.body.classList.add('modal-open');

  loadExifDetails(photo.src).then(function(exif) {
    if (!modal.root || modal.root.hidden || modal.root.getAttribute('data-src') !== photo.src) {
      return;
    }

    if (!exif) return;

    if (typeof exif.focalLength === 'number' && isFinite(exif.focalLength)) {
      modal.metaFocal.textContent = (Math.round(exif.focalLength * 10) / 10).toFixed(1) + ' mm';
    }

    modal.metaAperture.textContent = formatFNumber(exif.fNumber, exif.apertureValue);
  });
}

function closePhotoModal(modal) {
  if (!modal.root || !modal.image) return;

  modal.root.hidden = true;
  modal.root.removeAttribute('data-src');
  modal.image.src = '';
  document.body.classList.remove('modal-open');
}

function initAlbumPage() {
  var nav = document.getElementById('category-nav');
  var gallery = document.getElementById('album-gallery');
  var files = window.albumFiles;
  var albumName = window.albumName || 'Album';
  var modal = createPhotoModal();

  if (!nav || !gallery || !Array.isArray(files)) return;

  var categories = groupAlbumCategories(files);
  var categoryKeys = Object.keys(categories).sort();

  if (!categoryKeys.length) {
    gallery.innerHTML = '<p class="empty-state">No photos found for this album.</p>';
    return;
  }

  var photoIndex = [];
  categoryKeys.forEach(function(key) {
    var category = categories[key];
    category.items.forEach(function(src) {
      photoIndex.push({
        src: src,
        categoryKey: key,
        categoryLabel: category.label,
        filename: formatFileName(src),
        format: formatFileType(src)
      });
    });
  });

  var selectedCategory = 'all';

  function renderPhotoGrid() {
    gallery.innerHTML = '';
    var grid = document.createElement('div');
    grid.className = 'photo-grid';

    photoIndex
      .filter(function(photo) {
        return selectedCategory === 'all' || photo.categoryKey === selectedCategory;
      })
      .forEach(function(photo) {
        var img = document.createElement('img');
        img.src = photo.src;
        img.alt = albumName + ' - ' + photo.categoryLabel;
        img.className = 'photo-thumb';
        img.onclick = function() {
          openPhotoModal(modal, photo, albumName);
        };
        grid.appendChild(img);
      });

    gallery.appendChild(grid);
  }

  function renderCategoryPills() {
    nav.innerHTML = '';

    var allPill = document.createElement('button');
    allPill.type = 'button';
    allPill.className = 'category-pill' + (selectedCategory === 'all' ? ' is-active' : '');
    allPill.textContent = 'All (' + photoIndex.length + ')';
    allPill.onclick = function() {
      selectedCategory = 'all';
      renderCategoryPills();
      renderPhotoGrid();
    };
    nav.appendChild(allPill);

    categoryKeys.forEach(function(key) {
      var category = categories[key];
      var pill = document.createElement('button');
      pill.type = 'button';
      pill.className = 'category-pill' + (selectedCategory === key ? ' is-active' : '');
      pill.textContent = category.label + ' (' + category.items.length + ')';
      pill.onclick = function() {
        selectedCategory = key;
        renderCategoryPills();
        renderPhotoGrid();
      };
      nav.appendChild(pill);
    });
  }

  if (modal.closeButton) {
    modal.closeButton.onclick = function() {
      closePhotoModal(modal);
    };
  }

  if (modal.toggleButton) {
    modal.toggleButton.onclick = function() {
      var isFit = modal.root.classList.contains('photo-modal--fit');
      setModalFitMode(modal, !isFit);
    };
  }

  if (modal.root) {
    modal.root.addEventListener('click', function(event) {
      if (event.target && event.target.hasAttribute('data-close-modal')) {
        closePhotoModal(modal);
      }
    });
  }

  window.addEventListener('keydown', function(event) {
    if (event.key === 'Escape' && modal.root && !modal.root.hidden) {
      closePhotoModal(modal);
    }
  });

  renderCategoryPills();
  renderPhotoGrid();
}

window.addEventListener('load', function() {
  initHomePage();
  initAlbumPage();
});

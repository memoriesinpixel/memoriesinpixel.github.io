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
    closeButton: document.getElementById('photo-modal-close'),
    title: document.getElementById('photo-modal-title'),
    metaAlbum: document.getElementById('meta-album'),
    metaCategory: document.getElementById('meta-category'),
    metaFilename: document.getElementById('meta-filename'),
    metaFormat: document.getElementById('meta-format'),
    metaResolution: document.getElementById('meta-resolution')
  };
}

function openPhotoModal(modal, photo, albumName) {
  if (!modal.root || !modal.image) return;

  modal.title.textContent = photo.filename;
  modal.metaAlbum.textContent = albumName;
  modal.metaCategory.textContent = photo.categoryLabel;
  modal.metaFilename.textContent = photo.filename;
  modal.metaFormat.textContent = photo.format;
  modal.metaResolution.textContent = 'Loading...';

  modal.image.onload = function() {
    modal.metaResolution.textContent = modal.image.naturalWidth + ' × ' + modal.image.naturalHeight;
  };
  modal.image.src = photo.src;

  modal.root.hidden = false;
  document.body.classList.add('modal-open');
}

function closePhotoModal(modal) {
  if (!modal.root || !modal.image) return;

  modal.root.hidden = true;
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

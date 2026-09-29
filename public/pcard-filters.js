(function () {
  function init() {
    var bar = document.querySelector('.pcard-filter-bar');
    if (!bar) return;
    var cards = Array.prototype.slice.call(document.querySelectorAll('.pcard'));
    if (!cards.length) return;

    var priceInput = bar.querySelector('.pcard-filter-price-input');
    var priceLabel = bar.querySelector('.pcard-filter-price-label');
    var tagButtons = Array.prototype.slice.call(bar.querySelectorAll('.pcard-filter-tag'));
    var countEl = bar.querySelector('.pcard-filter-count');
    var emptyEl = document.querySelector('.pcard-filter-empty');
    var grids = Array.prototype.slice.call(document.querySelectorAll('.card-grid'));

    var activeUseCases = {};
    var activeConditions = {};

    function apply() {
      var maxPrice = priceInput ? Number(priceInput.value) : Infinity;
      var hasUseCaseFilter = Object.keys(activeUseCases).length > 0;
      var hasConditionFilter = Object.keys(activeConditions).length > 0;
      var visible = 0;

      cards.forEach(function (card) {
        var price = Number(card.getAttribute('data-price') || '0');
        var useCases = (card.getAttribute('data-usecases') || '').split(' ').filter(Boolean);
        var condition = card.getAttribute('data-condition') || '';
        var okPrice = price <= maxPrice;
        var okUseCase = !hasUseCaseFilter || useCases.some(function (uc) { return activeUseCases[uc]; });
        var okCondition = !hasConditionFilter || activeConditions[condition];
        var show = okPrice && okUseCase && okCondition;
        card.style.display = show ? '' : 'none';
        if (show) visible++;
      });

      if (countEl) {
        countEl.textContent = visible + (visible === 1 ? ' notebook mostrato' : ' notebook mostrati');
      }

      grids.forEach(function (grid) {
        var anyVisible = Array.prototype.some.call(grid.querySelectorAll('.pcard'), function (c) {
          return c.style.display !== 'none';
        });
        grid.style.display = anyVisible ? '' : 'none';
        var heading = grid.previousElementSibling;
        if (heading && heading.tagName === 'H2') {
          heading.style.display = anyVisible ? '' : 'none';
        }
      });

      if (emptyEl) emptyEl.style.display = visible === 0 ? 'block' : 'none';
    }

    if (priceInput) {
      priceInput.addEventListener('input', function () {
        if (priceLabel) priceLabel.textContent = 'Fino a ' + priceInput.value + ' \u20ac';
        apply();
      });
    }

    tagButtons.forEach(function (btn) {
      btn.addEventListener('click', function () {
        var type = btn.getAttribute('data-filter-type');
        var value = btn.getAttribute('data-filter-value');
        var set = type === 'usecase' ? activeUseCases : activeConditions;
        if (set[value]) {
          delete set[value];
          btn.classList.remove('active');
        } else {
          set[value] = true;
          btn.classList.add('active');
        }
        apply();
      });
    });

    apply();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();

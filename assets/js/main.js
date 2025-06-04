(function ($) {
  "use strict";
  /*=================================
        JS Index Here
    ==================================*/
  /*
    01. On Load Function
    02. Preloader
    03. Mobile Menu
    04. Sticky fix
    05. Scroll To Top
    06. Set Background Image Color & Mask
    07. Global Slider
    08. Ajax Contact Form
    09. Search Box Popup
    10. Popup Sidemenu
    11. Magnific Popup
    12. Section Position
    13. Filter
    14. Counter Up
    15. Shape Mockup
    16. Progress Bar Animation
    17. Countdown
    18. Image to SVG Code
    00. Woocommerce Toggle
    00. Color Scheme
    00. Right Click Disable
    */
  /*=================================
        JS Index End
    ==================================*/
  /*

  /*---------- 01. On Load Function ----------*/

  /*---------- 03. Mobile Menu ----------*/
  $.fn.thmobilemenu = function (options) {
    var opt = $.extend(
      {
        menuToggleBtn: ".th-menu-toggle",
        bodyToggleClass: "th-body-visible",
        subMenuClass: "th-submenu",
        subMenuParent: "menu-item-has-children",
        thSubMenuParent: "th-item-has-children",
        subMenuParentToggle: "th-active",
        meanExpandClass: "th-mean-expand",
        appendElement: '<span class="th-mean-expand"></span>',
        subMenuToggleClass: "th-open",
        toggleSpeed: 400,
      },
      options
    );

    return this.each(function () {
      var menu = $(this); // Select menu

      // Menu Show & Hide
      function menuToggle() {
        menu.toggleClass(opt.bodyToggleClass);

        // collapse submenu on menu hide or show
        var subMenu = "." + opt.subMenuClass;
        $(subMenu).each(function () {
          if ($(this).hasClass(opt.subMenuToggleClass)) {
            $(this).removeClass(opt.subMenuToggleClass);
            $(this).css("display", "none");
            $(this).parent().removeClass(opt.subMenuParentToggle);
          }
        });
      }

      // Class Set Up for every submenu
      menu.find("." + opt.subMenuParent).each(function () {
        var submenu = $(this).find("ul");
        submenu.addClass(opt.subMenuClass);
        submenu.css("display", "none");
        $(this).addClass(opt.subMenuParent);
        $(this).addClass(opt.thSubMenuParent); // Add th-item-has-children class
        $(this).children("a").append(opt.appendElement);
      });

      // Toggle Submenu
      function toggleDropDown($element) {
        var submenu = $element.children("ul");
        if (submenu.length > 0) {
          $element.toggleClass(opt.subMenuParentToggle);
          submenu.slideToggle(opt.toggleSpeed);
          submenu.toggleClass(opt.subMenuToggleClass);
        }
      }

      // Submenu toggle Button
      var itemHasChildren = "." + opt.thSubMenuParent + " > a";
      $(itemHasChildren).each(function () {
        $(this).on("click", function (e) {
          e.preventDefault();
          toggleDropDown($(this).parent());
        });
      });

      // Menu Show & Hide On Toggle Btn click
      $(opt.menuToggleBtn).each(function () {
        $(this).on("click", function () {
          menuToggle();
        });
      });

      // Hide Menu On outside click
      menu.on("click", function (e) {
        e.stopPropagation();
        menuToggle();
      });

      // Stop Hide full menu on menu click
      menu.find("div").on("click", function (e) {
        e.stopPropagation();
      });
    });
  };

  $(".th-menu-wrapper").thmobilemenu();

  /*----------- 22. One Page Nav ----------*/
  function onePageNav(element) {
    if ($(element).length > 0) {
      $(element).each(function () {
        var link = $(this).find("a");
        $(this)
          .find(link)
          .each(function () {
            $(this).on("click", function () {
              var target = $(this.getAttribute("href"));
              if (target.length) {
                event.preventDefault();
                $("html, body")
                  .stop()
                  .animate(
                    {
                      scrollTop: target.offset().top - 10,
                    },
                    2000
                  );
              }
            });
          });
      });
    }
  }
  onePageNav(".onepage-nav");
  onePageNav(".scroll-down");
  //one page sticky menu
  $(window).on("scroll", function () {
    if ($(".onepage-nav").length > 0) {
    }
  });

  /*---------- 04. Sticky fix ----------*/
  $(window).scroll(function () {
    var topPos = $(this).scrollTop();
    if (topPos > 500) {
      $(".sticky-wrapper").addClass("sticky");
      $(".category-menu").addClass("close-category");
    } else {
      $(".sticky-wrapper").removeClass("sticky");
      $(".category-menu").removeClass("close-category");
    }
  });

  $(".menu-expand").each(function () {
    $(this).on("click", function (e) {
      e.preventDefault();
      $(".category-menu").toggleClass("open-category");
    });
  });

  /*---------- 05. Scroll To Top ----------*/
  if ($(".scroll-top").length > 0) {
    var scrollTopbtn = document.querySelector(".scroll-top");
    var progressPath = document.querySelector(".scroll-top path");
    var pathLength = progressPath.getTotalLength();
    progressPath.style.transition = progressPath.style.WebkitTransition =
      "none";
    progressPath.style.strokeDasharray = pathLength + " " + pathLength;
    progressPath.style.strokeDashoffset = pathLength;
    progressPath.getBoundingClientRect();
    progressPath.style.transition = progressPath.style.WebkitTransition =
      "stroke-dashoffset 10ms linear";
    var updateProgress = function () {
      var scroll = $(window).scrollTop();
      var height = $(document).height() - $(window).height();
      var progress = pathLength - (scroll * pathLength) / height;
      progressPath.style.strokeDashoffset = progress;
    };
    updateProgress();
    $(window).scroll(updateProgress);
    var offset = 50;
    var duration = 750;
    jQuery(window).on("scroll", function () {
      if (jQuery(this).scrollTop() > offset) {
        jQuery(scrollTopbtn).addClass("show");
      } else {
        jQuery(scrollTopbtn).removeClass("show");
      }
    });
    jQuery(scrollTopbtn).on("click", function (event) {
      event.preventDefault();
      jQuery("html, body").animate({ scrollTop: 0 }, duration);
      return false;
    });
  }

  /*---------- 06. Set Background Image Color & Mask ----------*/
  if ($("[data-bg-src]").length > 0) {
    $("[data-bg-src]").each(function () {
      var src = $(this).attr("data-bg-src");
      $(this).css("background-image", "url(" + src + ")");
      $(this).removeAttr("data-bg-src").addClass("background-image");
    });
  }

  if ($("[data-bg-color]").length > 0) {
    $("[data-bg-color]").each(function () {
      var color = $(this).attr("data-bg-color");
      $(this).css("background-color", color);
      $(this).removeAttr("data-bg-color");
    });
  }

  $("[data-border]").each(function () {
    var borderColor = $(this).data("border");
    $(this).css("--th-border-color", borderColor);
  });

  if ($("[data-mask-src]").length > 0) {
    $("[data-mask-src]").each(function () {
      var mask = $(this).attr("data-mask-src");
      $(this).css({
        "mask-image": "url(" + mask + ")",
        "-webkit-mask-image": "url(" + mask + ")",
      });
      $(this).addClass("bg-mask");
      $(this).removeAttr("data-mask-src");
    });
  }

  /*----------- 07. Global Slider ----------*/
  $(".th-slider").each(function () {
    var thSlider = $(this);
    var settings = $(this).data("slider-options") || {};

    // Store references to the navigation Slider
    var prevArrow = thSlider.find(".slider-prev");
    var nextArrow = thSlider.find(".slider-next");
    var paginationEl1 = thSlider.find(".slider-pagination").get(0);
    var paginationEl2 = thSlider.find(".slider-pagination2");
    var progressBarEl = thSlider.find(
      ".slider-pagination-progressbar2 .slider-progressbar-fill"
    );

    var sliderDefault = {
      slidesPerView: 1,
      spaceBetween: settings.spaceBetween || 24,
      loop: settings.loop !== false,
      speed: settings.speed || 1000,
      autoplay: settings.autoplay || {
        delay: 6000,
        disableOnInteraction: false,
      },
      navigation: {
        prevEl: prevArrow.get(0),
        nextEl: nextArrow.get(0),
      },
      pagination: {
        el: paginationEl1,
        type: settings.paginationType || "bullets",
        clickable: true,
        renderBullet: function (index, className) {
          var number = index + 1;
          var formattedNumber = number < 10 ? "0" + number : number;
          return (
            '<span class="' +
            className +
            '" aria-label="Go to Slide ' +
            formattedNumber +
            '"></span>'
          );
        },
        renderFraction: function (currentClass, totalClass) {
          return (
            '<span class="' +
            currentClass +
            '"></span> <span class="divider">/</span> <span class="' +
            totalClass +
            '"></span>'
          );
        },
        formatFractionCurrent: function (number) {
          return number < 10 ? "0" + number : number;
        },
        formatFractionTotal: function (number) {
          return number < 10 ? "0" + number : number;
        },
      },
      on: {
        init: function () {
          // Update custom fraction pagination
          var totalSlides = this.slides.length;
          paginationEl2.html(
            '<span class="current-slide">01</span> <span class="divider">/</span>  <span class="total-slides">' +
              (totalSlides < 10 ? "0" + totalSlides : totalSlides) +
              "</span>"
          );

          // Set initial vertical progress bar height
          var progress = ((this.activeIndex + 1) / this.slides.length) * 100;
          progressBarEl.css("height", progress + "%");
        },
        slideChange: function () {
          // Update custom fraction pagination
          var activeIndex = this.realIndex + 1; // Use realIndex for loop mode
          var totalSlides = this.slides.length;
          paginationEl2.html(
            '<span class="current-slide">' +
              (activeIndex < 10 ? "0" + activeIndex : activeIndex) +
              '</span> <span class="divider">/</span> <span class="total-slides">' +
              (totalSlides < 10 ? "0" + totalSlides : totalSlides) +
              "</span>"
          );

          // Update vertical progress bar height
          var progress = ((this.realIndex + 1) / this.slides.length) * 100;
          progressBarEl.css("height", progress + "%");
        },
      },
    };

    var options = $.extend({}, sliderDefault, settings);
    new Swiper(thSlider.get(0), options); // Initialize Swiper
  });

  // Function to add animation classes
  function animationProperties() {
    $("[data-ani]").each(function () {
      var animationName = $(this).data("ani");
      $(this).addClass(animationName);
    });

    $("[data-ani-delay]").each(function () {
      var delayTime = $(this).data("ani-delay");
      $(this).css("animation-delay", delayTime);
    });
  }
  animationProperties();

  // Add click event handlers for external slider arrows based on data attributes
  $("[data-slider-prev], [data-slider-next]").on("click", function () {
    var sliderSelector =
      $(this).data("slider-prev") || $(this).data("slider-next");
    var targetSlider = $(sliderSelector);

    if (targetSlider.length) {
      var swiper = targetSlider[0].swiper;

      if (swiper) {
        if ($(this).data("slider-prev")) {
          swiper.slidePrev();
        } else {
          swiper.slideNext();
        }
      }
    }
  });

  /*--------------. Slider Tab -------------*/
  $.fn.activateSliderThumbs = function (options) {
    var opt = $.extend(
      {
        sliderTab: false,
        tabButton: ".tab-btn",
      },
      options
    );

    return this.each(function () {
      var $container = $(this);
      var $thumbs = $container.find(opt.tabButton);
      var $line = $('<span class="indicator"></span>').appendTo($container);

      var sliderSelector = $container.data("slider-tab");
      var $slider = $(sliderSelector);

      var swiper = $slider[0].swiper;

      $thumbs.on("click", function (e) {
        e.preventDefault();
        var clickedThumb = $(this);

        clickedThumb.addClass("active").siblings().removeClass("active");
        linePos(clickedThumb, $container);

        if (opt.sliderTab) {
          var slideIndex = clickedThumb.index();
          swiper.slideTo(slideIndex);
        }
      });

      if (opt.sliderTab) {
        swiper.on("slideChange", function () {
          var activeIndex = swiper.realIndex;
          var $activeThumb = $thumbs.eq(activeIndex);

          $activeThumb.addClass("active").siblings().removeClass("active");
          linePos($activeThumb, $container);
        });

        var initialSlideIndex = swiper.activeIndex;
        var $initialThumb = $thumbs.eq(initialSlideIndex);
        $initialThumb.addClass("active").siblings().removeClass("active");
        linePos($initialThumb, $container);
      }

      function linePos($activeThumb) {
        var thumbOffset = $activeThumb.position();

        var marginTop = parseInt($activeThumb.css("margin-top")) || 0;
        var marginLeft = parseInt($activeThumb.css("margin-left")) || 0;

        $line.css("--height-set", $activeThumb.outerHeight() + "px");
        $line.css("--width-set", $activeThumb.outerWidth() + "px");
        $line.css("--pos-y", thumbOffset.top + marginTop + "px");
        $line.css("--pos-x", thumbOffset.left + marginLeft + "px");
      }
    });
  };

  if ($(".project-number-pagination").length) {
    $(".project-number-pagination").activateSliderThumbs({
      sliderTab: true,
      tabButton: ".tab-btn",
    });
  }

  /*----------- 08. Ajax Contact Form ----------*/
  var form = ".ajax-contact";
  var invalidCls = "is-invalid";
  var $email = '[name="email"]';
  var $validation =
    '[name="name"],[name="email"],[name="subject"],[name="message"]'; // Removed number field
  var formMessages = $(".form-messages");

  function sendContact(formElement) {
    var formData = $(formElement).serialize();
    var valid = validateContact(formElement);

    if (valid) {
      // Show loading state
      $(formElement).find('[type="submit"]').prop("disabled", true);

      // Clear previous messages
      $(formElement)
        .find(".form-messages")
        .removeClass("error success")
        .html("");

      $.ajax({
        url: $(formElement).attr("action"),
        data: formData,
        type: "POST",
        dataType: "json", // Expect JSON response
      })
        .done(function (response) {
          console.log(response);

          if (response.success) {
            $(formElement)
              .find(".form-messages")
              .removeClass("error")
              .addClass("success")
              .html(response.message);

            // Clear the form on success
            $(formElement).trigger("reset");
          } else {
            let errorMessages = "";

            if (response.errors) {
              for (const key in response.errors) {
                if (response.errors.hasOwnProperty(key)) {
                  errorMessages += `<p style="color:red" >${response.errors[key]}</p>`;
                }
              }
            }
            $(formElement)
              .find(".form-messages")
              .removeClass("success")
              .addClass("error")
              .html(errorMessages || response.message);
          }
        })
        .fail(function (xhr, status, error) {
          var errorMessage = "Oops! An error occurred. Please try again.";
          if (xhr.responseJSON && xhr.responseJSON.message) {
            errorMessage = xhr.responseJSON.message;
          } else if (xhr.responseText) {
            errorMessage = xhr.responseText;
          }

          $(formElement)
            .find(".form-messages")
            .removeClass("success")
            .addClass("error")
            .html(errorMessage);
        })
        .always(function () {
          $(formElement).find('[type="submit"]').prop("disabled", false);
        });
    }
  }

  function validateContact(formElement) {
    var valid = true;
    var emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

    // Validate required fields
    $(formElement)
      .find($validation)
      .each(function () {
        if (!$(this).val().trim()) {
          $(this).addClass(invalidCls);
          valid = false;
        } else {
          $(this).removeClass(invalidCls);
        }
      });

    // Validate email format
    var emailInput = $(formElement).find($email);
    if (!emailRegex.test(emailInput.val().trim())) {
      emailInput.addClass(invalidCls);
      valid = false;
    } else {
      emailInput.removeClass(invalidCls);
    }

    return valid;
  }

  // Handle form submission
  $(document).on("submit", form, function (e) {
    e.preventDefault();
    sendContact(this);
  });

  // Remove error class when user starts typing
  $(document).on("input", $validation, function () {
    $(this).removeClass(invalidCls);
  });

  /*---------- 10. Popup Sidemenu ----------*/
  function popupSideMenu($sideMenu, $sideMunuOpen, $sideMenuCls, $toggleCls) {
    // Sidebar Popup
    $($sideMunuOpen).on("click", function (e) {
      e.preventDefault();
      $($sideMenu).addClass($toggleCls);
    });
    $($sideMenu).on("click", function (e) {
      e.stopPropagation();
      $($sideMenu).removeClass($toggleCls);
    });
    var sideMenuChild = $sideMenu + " > div";
    $(sideMenuChild).on("click", function (e) {
      e.stopPropagation();
      $($sideMenu).addClass($toggleCls);
    });
    $($sideMenuCls).on("click", function (e) {
      e.preventDefault();
      e.stopPropagation();
      $($sideMenu).removeClass($toggleCls);
    });
  }
  popupSideMenu(".sidemenu-cart", ".sideMenuToggler", ".sideMenuCls", "show");
  popupSideMenu(".sidemenu-info", ".sideMenuInfo", ".sideMenuCls", "show");

  /*---------- 12. Section Position ----------*/
  // Interger Converter
  function convertInteger(str) {
    return parseInt(str, 10);
  }

  $.fn.sectionPosition = function (mainAttr, posAttr) {
    $(this).each(function () {
      var section = $(this);

      function setPosition() {
        var sectionHeight = Math.floor(section.height() / 2), // Main Height of section
          posData = section.attr(mainAttr), // where to position
          posFor = section.attr(posAttr), // On Which section is for positioning
          topMark = "top-half", // Pos top
          bottomMark = "bottom-half", // Pos Bottom
          parentPT = convertInteger($(posFor).css("padding-top")), // Default Padding of  parent
          parentPB = convertInteger($(posFor).css("padding-bottom")); // Default Padding of  parent

        if (posData === topMark) {
          $(posFor).css("padding-bottom", parentPB + sectionHeight + "px");
          section.css("margin-top", "-" + sectionHeight + "px");
        } else if (posData === bottomMark) {
          $(posFor).css("padding-top", parentPT + sectionHeight + "px");
          section.css("margin-bottom", "-" + sectionHeight + "px");
        }
      }
      setPosition(); // Set Padding On Load
    });
  };

  var postionHandler = "[data-sec-pos]";
  if ($(postionHandler).length) {
    $(postionHandler).imagesLoaded(function () {
      $(postionHandler).sectionPosition("data-sec-pos", "data-pos-for");
    });
  }

  /*----------- 14. Counter Up ----------*/
  $(".counter-number").counterUp({
    delay: 30,
    time: 5000,
  });

  /*----------- 15. Shape Mockup ----------*/
  $.fn.shapeMockup = function () {
    var $shape = $(this);
    $shape.each(function () {
      var $currentShape = $(this),
        shapeTop = $currentShape.data("top"),
        shapeRight = $currentShape.data("right"),
        shapeBottom = $currentShape.data("bottom"),
        shapeLeft = $currentShape.data("left");
      $currentShape
        .css({
          top: shapeTop,
          right: shapeRight,
          bottom: shapeBottom,
          left: shapeLeft,
        })
        .removeAttr("data-top")
        .removeAttr("data-right")
        .removeAttr("data-bottom")
        .removeAttr("data-left")
        .parent()
        .addClass("shape-mockup-wrap");
    });
  };

  if ($(".shape-mockup")) {
    $(".shape-mockup").shapeMockup();
  }

  /*----------- 16. Progress Bar Animation ----------*/
  $(".progress-bar").waypoint(
    function () {
      $(".progress-bar").css({
        animation: "animate-positive 1.8s",
        opacity: "1",
      });
    },
    { offset: "100%" }
  );

  /************lettering js***********/
  function injector(t, splitter, klass, after) {
    var a = t.text().split(splitter),
      inject = "";
    if (a.length) {
      $(a).each(function (i, item) {
        inject +=
          '<span class="' + klass + (i + 1) + '">' + item + "</span>" + after;
      });
      t.empty().append(inject);
    }
  }

  var methods = {
    init: function () {
      return this.each(function () {
        injector($(this), "", "char", "");
      });
    },

    words: function () {
      return this.each(function () {
        injector($(this), " ", "word", " ");
      });
    },

    lines: function () {
      return this.each(function () {
        var r = "eefec303079ad17405c889e092e105b0";
        // Because it's hard to split a <br/> tag consistently across browsers,
        // (*ahem* IE *ahem*), we replaces all <br/> instances with an md5 hash
        // (of the word "split").  If you're trying to use this plugin on that
        // md5 hash string, it will fail because you're being ridiculous.
        injector($(this).children("br").replaceWith(r).end(), r, "line", "");
      });
    },
  };

  $.fn.lettering = function (method) {
    // Method calling logic
    if (method && methods[method]) {
      return methods[method].apply(this, [].slice.call(arguments, 1));
    } else if (method === "letters" || !method) {
      return methods.init.apply(this, [].slice.call(arguments, 0)); // always pass an array
    }
    $.error("Method " + method + " does not exist on jQuery.lettering");
    return this;
  };

  $(".circle-title-anime").lettering();
})(jQuery);

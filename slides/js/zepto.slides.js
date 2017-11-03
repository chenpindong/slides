;(function($) {

	/*
	   	 图片滚动效果
	    @jQuery or @String box : 滚动列表jQuery对象或者选择器 如：外层div
	    @object config : {
	            @Number width : 一次滚动宽度，默认为box里面第一个一级子元素宽度[如果子元素宽度不均匀则滚动效果会错乱]
	            @Number size : 列表长度，默认为box里面所有一级子元素个数[如果size不等于一级子元素个数，则不支持循环滚动]
	            @Boolean loop : 是否支持循环滚动 默认 true
	            @Boolean auto : 是否自动滚动,支持自动滚动时必须支持循环滚动，否则设置无效,默认为true
	            @Number auto_wait_time : 自动轮播一次时间间隔,默认为：3000ms
	            @Function callback : 滚动完回调函数，参入一个参数当前滚动节点索引值
	        }
	*/

	function slides(box, config) {
		this.box = $(box);
		this.ul = $(box).find('ul');
		this.config = $.extend({}, config || {});
		this.width = this.config.width || this.ul.children().eq(0).width(); //一次滚动的宽度
		this.height = this.config.height || this.ul.children().eq(0).height();
		this.size = this.config.size || this.ul.children().length; //
		this.loop = this.config.loop || true; //默认能循环滚动
		this.auto = this.config.auto || true; //默认自动滚动
		this.auto_wait_time = this.config.auto_wait_time || 3000; //轮播间隔
		this.scroll_time = 300; //滚动时长
		this.minleft = -this.width * (this.size - 1); //最小left值，注意是负数[不循环情况下的值]
		this.maxleft = 0; //最大lfet值[不循环情况下的值]
		this.now_left = 0; //初始位置信息[不循环情况下的值]
		this.point_x = null; //记录一个x坐标
		this.point_y = null; //记录一个y坐标
		this.move_left = false; //记录向哪边滑动
		this.index = 0; //记录当前位置
		this.busy = false; //记录是否正在滚动
		this.timer; //定时器
		this.arrow = this.config.arrow || true; //是否显示上一个，下一个按钮
		this.ol = this.config.ol || true; //是否显示数目条
		this.activeCss = 'flex-active'; //显示数选中样式
		this.isPercent = !!/^[0-9]*[1-9][0-9]*%$/.exec(this.config.width); //宽是否是百分比
		this.percent = this.isPercent ? this.config.width.replace('%', '') : 0;
		this.init();
	}

	$.extend(slides.prototype, {
		init: function() {
			this.bind_event();
			this.init_loop();
			this.auto_scroll();
		},
		bind_event: function() {
			var self = this;
			self.box.bind('touchstart', function(e) {
				if(e.touches.length == 1 && !self.busy) {
					self.point_x = e.touches[0].screenX;
					self.point_y = e.touches[0].screenY;
				}
			}).bind('touchmove', function(e) {
				if(e.touches.length == 1 && !self.busy) {
					return self.move(e.touches[0].screenX, e.touches[0].screenY); //这里根据返回值觉得是否阻止默认touch事件
				}
			}).bind('touchend', function(e) {
				!self.busy && self.move_end();
			});

			if(self.isPercent) {
				$(window).resize(function() {
					self.resize();
				});
			}
		},
		/*
		    初始化循环滚动,当一次性需要滚动多个子元素时，暂不支持循环滚动效果,
		    如果想实现一次性滚动多个子元素效果，可以通过页面结构实现
		    循环滚动思路：复制首尾节点到尾首
		*/
		init_loop: function() {
			var self = this;

			if(self.arrow) {
				self.box.append('<div class="arrow arrow_prev"></div><div class="arrow arrow_next"></div>');

				self.box.find('.arrow_prev').click(function() {
					self.prev();
				});

				self.box.find('.arrow_next').click(function() {
					self.next();
				});
			}

			if(self.ol) {
				var olHtml = '<ol class="flex-control-nav">';
				for(var i = 0; i < self.size; i++) {
					olHtml += '<li><a></a></li>';
				}
				olHtml += '</ol>';
				self.box.append(olHtml);
				self.box.find('.flex-control-nav li').eq(self.index).addClass(self.activeCss);

				self.box.find('.flex-control-nav li').click(function() {
					self.go_index($(this).index());
				});
			}

			if(self.ul.children().length == self.size && self.loop) { //暂时只支持size和子节点数相等情况的循环
				var clone1 = self.ul.find("li").eq(0).clone();
				var clone2 = self.ul.find("li").eq(self.size - 1).clone();

				$(clone1).addClass('clone');
				$(clone2).addClass('clone');

				self.ul.prepend(clone2);
				self.ul.append(clone1);
			} else {
				self.loop = false;
			}

			self.resize();
		},
		resize: function() {
			var self = this;

			if(self.isPercent) {
				self.width = self.box.width() * self.percent / 100;
			}

			if(self.loop) { //暂时只支持size和子节点数相等情况的循环
				self.now_left = -self.width * (self.index + 1); //设置初始位置信息
				self.minleft = -self.width * self.size; //最小left值
				self.maxleft = -self.width;

				self.ul.css({
					'width': self.width * (self.size + 2),
					'margin-left': self.now_left
				});
			} else {
				self.now_left = -self.width * self.index; //设置初始位置信息
				self.minleft = -self.width * (self.size - 1); //最小left值

				self.ul.css({
					'width': self.width * self.size,
					'margin-left': self.now_left
				});
			}

			self.ul.find("li").each(function(i, e) {
				var $li = $(e);
				$li.css({
					'width': self.width,
				});
			});
		},
		auto_scroll: function() { //自动滚动
			var self = this;
			if(!self.loop || !self.auto) return;
			clearTimeout(self.timer);
			self.timer = setTimeout(function() {
				self.go_index(self.index + 1);
			}, self.auto_wait_time);
		},
		go_index: function(ind) { //滚动到指定索引页面
			var self = this;
			if(self.busy) return;
			clearTimeout(self.timer);
			self.busy = true;
			if(self.loop) { //如果循环
				ind = ind < 0 ? -1 : ind;
				ind = ind > self.size ? self.size : ind;
			} else {
				ind = ind < 0 ? 0 : ind;
				ind = ind >= self.size ? (self.size - 1) : ind;
			}
			if(!self.loop && (self.now_left == -(self.width * ind))) {
				self.complete(ind);
			} else if(self.loop && (self.now_left == -self.width * (ind + 1))) {
				self.complete(ind);
			} else {
				if(ind == -1 || ind == self.size) { //循环滚动边界
					self.index = ind == -1 ? (self.size - 1) : 0;
					self.now_left = ind == -1 ? 0 : -self.width * (self.size + 1);
				} else {
					self.index = ind;
					self.now_left = -(self.width * (self.index + (self.loop ? 1 : 0)));
				}

				self.ul.animate({
					'margin-left': -self.width * (self.loop ? (ind + 1) : ind)
				}, self.scroll_time, function() {
					self.complete(ind);
				});
			}
		},
		complete: function(ind) { //动画完成回调
			var self = this;
			self.busy = false;
			self.box.find('.flex-control-nav li').removeClass(self.activeCss).eq(self.index).addClass(self.activeCss);

			self.config.callback && self.config.callback(self.index);
			if(ind == -1) {
				self.now_left = self.minleft;
			} else if(ind == self.size) {
				self.now_left = self.maxleft;
			}

			self.ul.css({
				'margin-left': self.now_left
			});

			self.auto_scroll();
		},
		next: function() { //下一页滚动
			if(!this.busy) {
				this.go_index(this.index + 1);
			}
		},
		prev: function() { //上一页滚动
			if(!this.busy) {
				this.go_index(this.index - 1);
			}
		},
		move: function(point_x, point_y) { //滑动屏幕处理函数
			var changeX = point_x - (this.point_x === null ? point_x : this.point_x),
				changeY = point_y - (this.point_y === null ? point_y : this.point_y),
				marginleft = this.now_left,
				return_value = false,
				sin = changeY / Math.sqrt(changeX * changeX + changeY * changeY);
			this.now_left = marginleft + changeX;
			this.move_left = changeX < 0;
			if(sin > Math.sin(Math.PI / 3) || sin < -Math.sin(Math.PI / 3)) { //滑动屏幕角度范围：PI/3  -- 2PI/3
				return_value = true; //不阻止默认行为
			}
			this.point_x = point_x;
			this.point_y = point_y;

			return return_value;
		},
		move_end: function() {
			var changeX = this.now_left % this.width,
				ind;
			if(this.now_left < this.minleft) { //手指向左滑动
				ind = this.index + 1;
			} else if(this.now_left > this.maxleft) { //手指向右滑动
				ind = this.index - 1;
			} else if(changeX != 0) {
				if(this.move_left) { //手指向左滑动
					ind = this.index + 1;
				} else { //手指向右滑动
					ind = this.index - 1;
				}
			} else {
				ind = this.index;
			}
			this.point_x = this.point_y = null;
			this.go_index(ind);
		}
	});

	/*
	    这里对外提供调用接口，对外提供接口方法
	    next ：下一页
	    prev ：上一页
	    go ：滚动到指定页
	*/
	$.slides = function(box, config) {
		var loopbox = new slides(box, config);

		return { //对外提供接口
			next: function() {
				loopbox.next();
			},
			prev: function() {
				loopbox.prev();
			},
			go: function(ind) {
				loopbox.go_index(parseInt(ind) || 0);
			}
		}
	}

})(Zepto)
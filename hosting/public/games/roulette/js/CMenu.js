function CMenu(){
    var _pStartPosAudio;
    var _pStartPosInfo;
    var _pStartPosPlayDemo;
    var _pStartPosPlayReal;
    var _pStartPosLang;
    var _pStartPosFullscreen;
    
    var _oButFullscreen;
    var _fRequestFullScreen = null;
    var _fCancelFullScreen = null;
    var _oBg;
    var _oButPlayDemo;
    var _oButPlayReal;
    var _oButLang;
    var _oButInfo;
    var _oAudioToggle;
    var _oFade;
    
    this._init = function(){
        _oBg = createBitmap(s_oSpriteLibrary.getSprite('bg_menu'));
        s_oStage.addChild(_oBg);

        var oSprite = s_oSpriteLibrary.getSprite('but_bg');
        _pStartPosPlayDemo = {x: (CANVAS_WIDTH/2) - 130, y: CANVAS_HEIGHT - 110};
        _oButPlayDemo = new CTextButton(_pStartPosPlayDemo.x, _pStartPosPlayDemo.y, oSprite, TEXT_PLAY_DEMO, FONT1, "#fff", 20, s_oStage);
        _oButPlayDemo.addEventListener(ON_MOUSE_UP, this._onButPlayDemoRelease, this);

        _pStartPosPlayReal = {x: (CANVAS_WIDTH/2) + 130, y: CANVAS_HEIGHT - 110};
        _oButPlayReal = new CTextButton(_pStartPosPlayReal.x, _pStartPosPlayReal.y, oSprite, TEXT_PLAY_REAL, FONT1, "#fff", 20, s_oStage);
        _oButPlayReal.addEventListener(ON_MOUSE_UP, this._onButPlayRealRelease, this);

        if(DISABLE_SOUND_MOBILE === false || s_bMobile === false){
            var oSprite = s_oSpriteLibrary.getSprite('audio_icon');
            _pStartPosAudio = {x: CANVAS_WIDTH - (oSprite.width/4)- 10, y: (oSprite.height/2) + 10}; 
            _oAudioToggle = new CToggle(_pStartPosAudio.x,_pStartPosAudio.y,oSprite,s_bAudioActive,s_oStage);
            _oAudioToggle.addEventListener(ON_MOUSE_UP, this._onAudioToggle, this);
        }
        
        var oSpriteFullscreen = s_oSpriteLibrary.getSprite('but_fullscreen');
        if(SHOW_CREDITS){
            var oSprite = s_oSpriteLibrary.getSprite('but_credits');
            _pStartPosInfo = {x: (oSprite.width/2) + 10, y: (oSprite.height/2) + 10}; 
            _oButInfo = new CGfxButton(_pStartPosInfo.x,_pStartPosInfo.y,oSprite,s_oStage);
            _oButInfo.addEventListener(ON_MOUSE_UP, this._onCredits, this);

            _pStartPosFullscreen = {x:_pStartPosInfo.x + oSpriteFullscreen.width/2 + 10,y:(oSpriteFullscreen.height/2) + 10};
        }else{
            _pStartPosFullscreen = {x: (oSpriteFullscreen.width/2) + 10, y: (oSpriteFullscreen.height/2) + 10}; 
        }
        
        var doc = window.document;
        var docEl = doc.documentElement;
        _fRequestFullScreen = docEl.requestFullscreen || docEl.mozRequestFullScreen || docEl.webkitRequestFullScreen || docEl.msRequestFullscreen;
        _fCancelFullScreen = doc.exitFullscreen || doc.mozCancelFullScreen || doc.webkitExitFullscreen || doc.msExitFullscreen;
        
        if(ENABLE_FULLSCREEN === false){
            _fRequestFullScreen = false;
        }
        
        if (_fRequestFullScreen && screenfull.isEnabled){
            

            _oButFullscreen = new CToggle(_pStartPosFullscreen.x,_pStartPosFullscreen.y,oSpriteFullscreen,s_bFullscreen,s_oStage);
            _oButFullscreen.addEventListener(ON_MOUSE_UP, this._onFullscreenRelease, this);
        }

        _pStartPosLang = {x: (CANVAS_WIDTH/2), y: CANVAS_HEIGHT - 185};
        _oButLang = new createjs.Container();
        _oButLang.x = _pStartPosLang.x;
        _oButLang.y = _pStartPosLang.y;
        _oButLang.cursor = "pointer";
        s_oStage.addChild(_oButLang);

        // 1. Background Pill
        var oBgPill = new createjs.Shape();
        oBgPill.graphics.beginFill("rgba(0, 0, 0, 0.75)")
                       .beginStroke("#ffbc00") // Sleek gold outline
                       .setStrokeStyle(2.5)
                       .drawRoundRect(-80, -20, 160, 40, 20);
        _oButLang.addChild(oBgPill);

        // 2. Selection Pill (glowing highlight)
        var oHighlight = new createjs.Shape();
        oHighlight.graphics.beginFill("#ffbc00").drawRoundRect(-38, -17, 76, 34, 17);
        _oButLang.addChild(oHighlight);

        // 3. EN Text
        var oTextEN = new createjs.Text("EN", "bold 15px Cairo", "#fff");
        oTextEN.textAlign = "center";
        oTextEN.textBaseline = "middle";
        oTextEN.x = -40;
        oTextEN.y = 2; 
        _oButLang.addChild(oTextEN);

        // 4. AR Text
        var oTextAR = new createjs.Text("عربي", "bold 15px Cairo", "#fff");
        oTextAR.textAlign = "center";
        oTextAR.textBaseline = "middle";
        oTextAR.x = 40;
        oTextAR.y = 0;
        _oButLang.addChild(oTextAR);

        var updateLangSwitcher = function() {
            if (s_szCurLang === "en") {
                createjs.Tween.get(oHighlight, {override:true}).to({x: -40}, 200, createjs.Ease.cubicOut);
                oTextEN.color = "#000000";
                oTextAR.color = "#ffbc00";
            } else {
                createjs.Tween.get(oHighlight, {override:true}).to({x: 40}, 200, createjs.Ease.cubicOut);
                oTextEN.color = "#ffbc00";
                oTextAR.color = "#000000";
            }
        };

        // Initialize state
        if (s_szCurLang === "en") {
            oHighlight.x = -40;
            oTextEN.color = "#000000";
            oTextAR.color = "#ffbc00";
        } else {
            oHighlight.x = 40;
            oTextEN.color = "#ffbc00";
            oTextAR.color = "#000000";
        }

        // Add interactive hover scaling
        _oButLang.on("rollover", function() {
            _oButLang.scaleX = 1.05;
            _oButLang.scaleY = 1.05;
        });
        _oButLang.on("rollout", function() {
            _oButLang.scaleX = 1;
            _oButLang.scaleY = 1;
        });

        // Click handler
        _oButLang.on("mousedown", function(evt) {
            var localPoint = _oButLang.globalToLocal(evt.stageX, evt.stageY);
            if (localPoint.x < 0) {
                // Clicked English
                if (s_szCurLang !== "en") {
                    refreshLanguage("en");
                    updateLangSwitcher();
                    _oButPlayDemo.changeText(TEXT_PLAY_DEMO);
                    _oButPlayReal.changeText(TEXT_PLAY_REAL);
                    playSound("click", 1, false);
                }
            } else {
                // Clicked Arabic
                if (s_szCurLang !== "ar") {
                    refreshLanguage("ar");
                    updateLangSwitcher();
                    _oButPlayDemo.changeText(TEXT_PLAY_DEMO);
                    _oButPlayReal.changeText(TEXT_PLAY_REAL);
                    playSound("click", 1, false);
                }
            }
        });

        // Add position/unload compatibility helpers
        _oButLang.setPosition = function(iXPos, iYPos) {
            this.x = iXPos;
            this.y = iYPos;
        };
        _oButLang.unload = function() {
            s_oStage.removeChild(this);
        };

        _oFade = new createjs.Shape();
        _oFade.graphics.beginFill("black").drawRect(0,0,CANVAS_WIDTH,CANVAS_HEIGHT);
        
        s_oStage.addChild(_oFade);
        
        createjs.Tween.get(_oFade).to({alpha:0}, 400).call(function(){_oFade.visible = false;});  
        
        this.refreshButtonPos(s_iOffsetX, s_iOffsetY);
    };
    
    this.refreshButtonPos = function (iNewX, iNewY) {
        if (DISABLE_SOUND_MOBILE === false || s_bMobile === false) {
            _oAudioToggle.setPosition(_pStartPosAudio.x - iNewX, iNewY + _pStartPosAudio.y);
        }
        if (_fRequestFullScreen && screenfull.isEnabled){
            _oButFullscreen.setPosition(_pStartPosFullscreen.x + iNewX,_pStartPosFullscreen.y + iNewY);
        }
        if(SHOW_CREDITS){
            _oButInfo.setPosition(_pStartPosInfo.x + iNewX,iNewY + _pStartPosInfo.y);
        }
        _oButPlayDemo.setPosition(_pStartPosPlayDemo.x, _pStartPosPlayDemo.y - iNewY);
        _oButPlayReal.setPosition(_pStartPosPlayReal.x, _pStartPosPlayReal.y - iNewY);
        _oButLang.setPosition(_pStartPosLang.x, _pStartPosLang.y - iNewY);
    };
    
    this.unload = function(){
        _oButPlayDemo.unload();
        _oButPlayDemo = null;
        
        _oButPlayReal.unload();
        _oButPlayReal = null;
        
        _oButLang.unload();
        _oButLang = null;
        
        if(SHOW_CREDITS){
            _oButInfo.unload();
            _oButInfo = null;
        }
        
        
        if(DISABLE_SOUND_MOBILE === false || s_bMobile === false){
            _oAudioToggle.unload();
            _oAudioToggle = null;
        }
        if (_fRequestFullScreen && screenfull.isEnabled){
            _oButFullscreen.unload();
        }
        s_oStage.removeChild(_oBg);
        _oBg = null;
        
        s_oStage.removeChild(_oFade);
        _oFade = null;
        s_oMenu = null;
    };
    
    this._onButPlayDemoRelease = function(){
        this.unload();
        s_bDemoMode = true;
        s_oMain.setMoney(100000); // virtual credit starting value (100,000)
        s_oMain.gotoGame();
        $(s_oMain).trigger("start_session");
    };

    this._onButPlayRealRelease = function(){
        var oParent = this;
        if (typeof window.db_getUserBalance === "function") {
            window.db_getUserBalance(function(iBalance){
                oParent.unload();
                s_bDemoMode = false;
                s_oMain.setMoney(iBalance);
                s_oMain.gotoGame();
                $(s_oMain).trigger("start_session");
            });
        } else {
            oParent.unload();
            s_bDemoMode = false;
            s_oMain.setMoney(25000);
            s_oMain.gotoGame();
            $(s_oMain).trigger("start_session");
        }
    };

    this._onButLangRelease = function(){
        if (s_szCurLang === "ar") {
            refreshLanguage("en");
            _oButLang.changeText("عربي");
        } else {
            refreshLanguage("ar");
            _oButLang.changeText("English");
        }
        _oButPlayDemo.changeText(TEXT_PLAY_DEMO);
        _oButPlayReal.changeText(TEXT_PLAY_REAL);
    };

    this._onAudioToggle = function(){
        Howler.mute(s_bAudioActive);
        s_bAudioActive = !s_bAudioActive;
    };
    
    this._onCredits = function(){
        new CCreditsPanel();
    };
    
    this.resetFullscreenBut = function(){
	if (_fRequestFullScreen && screenfull.isEnabled){
		_oButFullscreen.setActive(s_bFullscreen);
	}
    };

    this._onFullscreenRelease = function(){
        if(s_bFullscreen) { 
		_fCancelFullScreen.call(window.document);
	}else{
		_fRequestFullScreen.call(window.document.documentElement);
	}
	
	sizeHandler();
    };
    
    s_oMenu = this;
    
    this._init();
}

var s_oMenu = null;
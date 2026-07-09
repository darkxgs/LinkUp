// CTLTEXT - v2.7.2

CTLText.prototype = {
    
    constructor : CTLText,
    
    __autofit : function(){
        var szMsg = this._szMsg;
        var bEllipsis = szMsg.length < 3?false:this._bEllipsis;

        if(bEllipsis){
            this._oText.text = this._szMsg;
        }

        if(!bEllipsis && !this._bMultiline){
            this.__autofitLight();
            return;
        }

        var iEndSliceIndex = szMsg.length-2;
        var iFontSize = this._iStartingFontSize; 

        this.__refreshTextFont(iFontSize);

        var oTextBounds = this._oText.getBounds();
        var iMaxWidth = this._iEffectiveWidth-this._iOutline;
        var iMaxHeight = this._iEffectiveHeight-this._iOutline;
        while(oTextBounds.height > iMaxHeight || oTextBounds.width > iMaxWidth){
            if(bEllipsis && iFontSize < this._iMinTextSize){
                iEndSliceIndex--;
                this._oText.text = szMsg.slice(
                    0,iEndSliceIndex
                )+"...";

                this.__updateY();        
                this.__verticalAlign();    

                if(iEndSliceIndex == 1){
                    break;
                };
            }else{
                iFontSize--;
                this.__refreshTextFont(iFontSize); 

                this.__updateY();        
                this.__verticalAlign();    

                if ( iFontSize < this._iMinTextSize && !bEllipsis){
                    break;
                }
            }

            oTextBounds = this._oText.getBounds();
        };
        
        this._iFontSize = iFontSize;

        this.__updateY();        
        this.__verticalAlign();    
        this.__updateStroke();
    },

    __autofitLight : function(){
        this.__refreshTextFont(this._iStartingFontSize);

        var oTextBounds = this._oText.getBounds();
        var iMaxWidth = this._iEffectiveWidth-this._iOutline;
        var iMaxHeight = this._iEffectiveHeight-this._iOutline;
        if (iMaxWidth-oTextBounds.width < iMaxHeight-oTextBounds.height) {
            var iFontSize = Math.floor(this.__linearFunction(
                this._iEffectiveWidth-this._iOutline,
                oTextBounds.width, 0,
                this._iStartingFontSize, 0
            ));
        }else{
            var iFontSize = Math.floor(this.__linearFunction(
                this._iEffectiveHeight-this._iOutline,
                oTextBounds.height, 0,
                this._iStartingFontSize, 0
            ));
        }

        if(iFontSize>this._iStartingFontSize){
            iFontSize = this._iStartingFontSize;
        }else if(iFontSize < this._iMinTextSize){
            iFontSize = this._iMinTextSize;
        }

        this.__refreshTextFont(iFontSize);

        this._iFontSize = iFontSize;

        this.__updateY();        
        this.__verticalAlign();    
        this.__updateStroke();
    },

    __linearFunction : function(x, x1, x2, y1, y2){
        return ( (x-x1)*(y2-y1)/(x2-x1) ) + y1; 
    },

    __checkAutofit : function(){
        if (this._bFitText) {
            this.__autofit();
        }else{
            this.__refreshTextFont(this._iStartingFontSize);

            this.__updateY();        
            this.__verticalAlign();    
            this.__updateStroke();
        }
    },
    
    __refreshTextFont : function(iFontSize){
        this._oText.font = iFontSize+"px "+this._szFont;
        this._oText.lineHeight = Math.round(iFontSize*this._fLineHeightFactor);
    },

    __verticalAlign : function(){
        if(this._bVerticalAlign){
            var iCurHeight = this._oText.getBounds().height;          
            this._oText.y -= (iCurHeight-this._iHeight)/2 + (this._iPaddingV);  
        }        
    },

    __updateY : function(){
        this._oText.y = this._iPaddingV;

        switch(this._oText.textBaseline){
            case "middle":{
                this._oText.y += (this._oText.lineHeight/2) +
                                 (this._iFontSize*this._fLineHeightFactor-this._iFontSize);                    
            }break;
        }
    },

    __updateStroke : function(){
        if(this._oStroke){
            this._oStroke.x = this._oText.x;
            this._oStroke.y = this._oText.y;
            this._oStroke.text = this._oText.text;
            this._oStroke.font = this._oText.font;
            this._oStroke.lineHeight = this._oText.lineHeight;
        }
    },

    __updateOutline : function(){
        if(this._oStroke && this._oStroke.outline > this._oText.outline){
            this._iOutline = this._oStroke.outline;
        }else{
            this._iOutline = this._oText.outline;
        }
    },

    __updateHorizontalAlign : function(){
        switch(this._szAlign){
            case "center":{
                this._oText.x = (this._iWidth/2);
            }break;
            case "left":{
                this._oText.x = this._iPaddingH;
            }break;   
            case "right":{
                this._oText.x = this._iWidth-this._iPaddingH;
            }break;       
        }
    },

    __setMsg : function(szMsg){
        this._szMsg = szMsg;
        if(this._szMsg === "" || (!this._szMsg && this._szMsg !== 0)){
            this._szMsg = " ";
        }
    },

    __createDebugShape : function(){
        this._oDebugShape = new createjs.Shape();
        this.__refreshDebugShape();
    },

    __refreshDebugShape : function(){
        this._oDebugShape.graphics.clear();
        this._oDebugShape.graphics
        .beginFill("rgba(255,130,0,0.5)")
        .drawRect(0, 0, this._iWidth, this._iHeight)
        .moveTo(this._iPaddingH,this._iHeight-this._iPaddingV)
        .lineTo(this._iWidth-this._iPaddingH,this._iHeight-this._iPaddingV)
        .lineTo(this._iWidth-this._iPaddingH,this._iPaddingV)
        .lineTo(this._iPaddingH,this._iPaddingV)
        .closePath()
        .beginFill("rgba(255,0,0,0.5)")
        .drawRect(
            this._iPaddingH,
            this._iPaddingV,
            this._iEffectiveWidth,
            this._iEffectiveHeight
        );
    },

    __updateLineWidth : function(){
        if ( this._bMultiline ){
            this._oText.lineWidth = this._iWidth - (this._iPaddingH*2);
        }else{
            this._oText.lineWidth = null;
        }

        if(this._oStroke){
            this._oStroke.lineWidth = this._oText.lineWidth;
        }
    },

    __updateWidth : function(){
        this.__updateLineWidth();
        this.__updateHorizontalAlign();
    },

    __updateSize : function(){
        this.__checkAutofit();

        if (this._bDebug){
            this.__refreshDebugShape();
        }
    },

    __createText : function(){
        if (this._bDebug){
            this.__createDebugShape();
            this._oContainer.addChild(this._oDebugShape);
        }

        this._oText = new createjs.Text(this._szMsg, this._iFontSize+"px "+this._szFont, this._szColor);
        this._oText.textBaseline = "middle";
        this._oText.lineHeight = Math.round(this._iFontSize*this._fLineHeightFactor);
        this._oText.textAlign = this._szAlign;
        
        this.__updateLineWidth();
        this.__updateHorizontalAlign();

        this._oContainer.addChild(this._oText);

        try{
            ///BUG IN CREATEJS!! IF WE DO NOT CHECK 2d BEFORE, THE LIBRARY CRASH IF WITH A NORMAL createjs.Stage
            var o2dCtx  = s_oCanvas.getContext('2d');
            /////

            var oWebGLCtx = !!window.WebGLRenderingContext && (s_oCanvas.getContext('webgl') || s_oCanvas.getContext('experimental-webgl'));
            var bIsWebGLActive = oWebGLCtx !== null;

            this._bMandatoryCache = bIsWebGLActive;
            this.setCacheActive(bIsWebGLActive);
        }catch(e){
            this._bMandatoryCache = false;
            this.setCacheActive(false);
        }
        
        this.refreshText(this._szMsg);
    },  

    setStroke : function(iSize,szColor){
        if (!this._oStroke){
            this._oStroke = this._oText.clone();
            this._oContainer.addChild(this._oStroke);

            this._oContainer.swapChildren(this._oStroke,this._oText);
        }

        this.setStrokeColor(szColor?szColor:this._szStrokeColor);
        this.setStrokeSize(iSize?iSize:this._iStrokeSize);
		
        this.updateCache();
    },

    setStrokeColor : function(szColor){
        this._szStrokeColor = szColor;
        if (this._oStroke){
            this._oStroke.color = this._szStrokeColor;
			
            this.updateCache();
        }
    },

    setStrokeSize : function(iSize){
        this._iStrokeSize = iSize;
        if (this._oStroke){
            this._oStroke.outline = this._iStrokeSize;

            this.__updateOutline();
            
            this.__checkAutofit();
			
            this.updateCache();
        }
    },

    removeStroke : function(){
        if(this._oStroke){
            this._oContainer.removeChild(this._oStroke);
            this._oStroke = null;
            
            this.__updateOutline();

            this.__checkAutofit();
			
            this.updateCache();
        }
    },

    roll : function(iScore,iTime,ease,cbCompleted,cbOwner,aParams){
        iTime = iTime==null?1500:iTime;
        ease = ease==null?createjs.Ease.linear:ease;

        var oRollingScore = {score:parseInt(this._szMsg)};
        this._szMsg = iScore;

        var oCbChange;
        if(this._bFitText){
            oCbChange = function(){
                this._oText.text = Math.floor(oRollingScore.score);
                this.__autofitLight();
				
                this.updateCache();
            };
        }else{
            oCbChange = function(){
                this._oText.text = Math.floor(oRollingScore.score);
                this.__updateY();        
                this.__verticalAlign();    
                this.__updateStroke();
				
                this.updateCache();
            };
        }
        
        this.stopRolling();

        this._oTweenRollText = createjs.Tween.get(oRollingScore, {override:true})
        .to({score: iScore}, iTime, ease);

        this._oTweenRollText.on("change",oCbChange,this);
        this._oTweenRollText.on("complete",function(){

            if(cbCompleted){
                cbCompleted.apply(cbOwner,aParams);
            }

            this.stopRolling();
        },this,true);
    },

    isRolling : function(){
        return this._oTweenRollText == null?false:true;
    },

    stopRolling : function(){
        if (this.isRolling()) {
            this._oTweenRollText.removeAllEventListeners();
            this._oTweenRollText.paused = true;
            this._oTweenRollText = null;
        }
    },

    pauseRolling : function(){
        if (this.isRolling()) {
            this._oTweenRollText.paused = true;
        }
    },
    
    resumeRolling: function(){
        if (this.isRolling()) {
            this._oTweenRollText.paused = false;
        }
    },

    setY : function(iNewY){
        this._oContainer.y = iNewY;
    },

    setX : function(iNewX){
        this._oContainer.x = iNewX;
    },

    setHorizontalSize : function(iWidth,iPaddingH = this._iPaddingH){
        this.__setHorizontalSizeVars(iWidth,iPaddingH);

        this.__updateWidth();

        this.__updateSize();
		
        this._updateCacheSize();
    },

    setVerticalSize : function(iHeight,iPaddingV = this._iPaddingV){
        this.__setVerticalSizeVars(iHeight,iPaddingV);

        this.__updateSize();
		
		this._updateCacheSize();
    },

    setSize : function(
        iWidth,iHeight,iPaddingH = this._iPaddingH,iPaddingV = this._iPaddingV
    ){
        this.__setHorizontalSizeVars(iWidth,iPaddingH);
        this.__setVerticalSizeVars(iHeight,iPaddingV);

        this.__updateWidth();
        this.__updateSize();
		
        this._updateCacheSize();
    },

    __setHorizontalSizeVars : function(iWidth,iPaddingH){
        this._iWidth  = iWidth;
        this._iPaddingH = iPaddingH;

        this._iEffectiveWidth = this._iWidth-this._iPaddingH*2;
    },

    __setVerticalSizeVars : function(iHeight,iPaddingV){
        this._iHeight = iHeight;
        this._iPaddingV = iPaddingV;

        this._iEffectiveHeight = this._iHeight-this._iPaddingV*2;
    },
    
    setPosition : function(iNewX, iNewY){
        this._oContainer.x = iNewX;
        this._oContainer.y = iNewY;
    },
    
    setHorizontalAlign : function(szAlign){
        this._szAlign = szAlign;
        this._oText.textAlign = this._szAlign;
        
        this.__updateHorizontalAlign();
		
        this.updateCache();
    },
    
    setVerticalAlign : function( bVerticalAlign ){
        this._bVerticalAlign = bVerticalAlign;
    },
    
    setOutline : function(iSize){
        this._oText.outline = iSize;
        this.__updateOutline();
		
        this.updateCache();
    },
    
    setShadow : function(szColor,iOffsetX,iOffsetY,iBlur){
        this._oText.shadow = new createjs.Shadow(szColor, iOffsetX,iOffsetY,iBlur);
		
        this.updateCache();
    },
    
    setColor : function(szColor){
        this._szColor = szColor;
        this._oText.color = this._szColor;
		
        this.updateCache();
    },
    
    setAlpha : function(iAlpha){
        this._oContainer.alpha = iAlpha;
    },

    setVisible : function(bVisible){
        this._oContainer.visible = bVisible;
    },

    setFontSize : function(iSize){
        this._iFontSize = this._iStartingFontSize = iSize;
        this.refreshText(this._szMsg);
    },

    setRegX : function(iRegX){
        this._oContainer.regX = iRegX;
    },

    setRegY : function(iRegY){
        this._oContainer.regY = iRegY;
    },

    setScale : function(fScale){
        this._oContainer.scale = fScale;
    },
    
    setParentContainer : function(oParentContainer){    
        if(oParentContainer.contains(this._oContainer)){
            return;
        }

        this.removeContainerFromParent();
        this._oParentContainer = oParentContainer;
        this._oParentContainer.addChild(this._oContainer);
    },

    removeContainerFromParent : function(){
        if(this._oParentContainer){
            this._oParentContainer.removeChild(this._oContainer);
            this._oParentContainer = null;
        }
    },

    setCacheActive : function(bActive,fCacheScale = 1){
        var bScaleChanged = false;
        if(this._fCacheScale != fCacheScale && bActive){
            bScaleChanged = true;
            this._oContainer.uncache();
        }

        if(!bScaleChanged && this._bMandatoryCache){
            return
        }
        
        this._fCacheScale = fCacheScale;

        if((!this._bCacheActive && bActive) || bScaleChanged){
            this._oContainer.cache(
                0,0,
                this.__nextPow2(this._iEffectiveWidth),
                this.__nextPow2(this._iEffectiveHeight),
                this._fCacheScale
            );
        }else if(this._bCacheActive && !bActive){
            this._oContainer.uncache();
        }

        this._bCacheActive = bActive;
    },

    _updateCacheSize : function(){
        if(this._bCacheActive){
            this._oContainer.uncache();
            this._oContainer.cache(
                0,0,
                this.__nextPow2(this._iEffectiveWidth),
                this.__nextPow2(this._iEffectiveHeight),
                this._fCacheScale
            );
        }
    },

    __nextPow2 : function(N){
        var a = Math.floor(Math.log2(N));
        if (Math.pow(2, a) === N) {
            return N;
        }
        return Math.pow(2, a + 1);
    },

    updateCache : function(){
        if(this._bCacheActive){
            this._oContainer.updateCache();
        }
    },

    removeTweens : function(){
        createjs.Tween.removeTweens(this._oContainer);
    },
    
    getText : function(){
        return this._oText;
    },

    getTextWidth : function(){
        return this._oText.getBounds().width+this._iOutline;
    },

    getTextHeight : function(){
        return this._oText.getBounds().height+this._iOutline;
    },
    
    getMsg : function(){
        return this._szMsg;
    },
    
    getX : function(){
        return this._oContainer.x;
    },
    
    getY : function(){
        return this._oContainer.y;
    },

    getHeight : function(){
        return this._iHeight;
    },
    
    getWidth : function(){
        return this._iWidth;
    },

    getPaddingH : function(){
        return this._iPaddingH;
    },

    getPaddingV : function(){
        return this._iPaddingV;
    },

    getColor : function(){
        return this._szColor;
    },
    
    getFontSize : function(){
        return this._iFontSize;
    },

    getContainer : function(){
        return this._oContainer;
    },

    unload : function(){
        this.stopRolling();

        if(this._bCacheActive){
            this._oContainer.uncache();
        }

        createjs.Tween.removeTweens(this._oContainer);
        this.removeContainerFromParent();
    },
    
    refreshText : function(szMsg){   
        this.__setMsg(szMsg);

        this._oText.text = this._szMsg;
        
        this.__checkAutofit();
		
        this.updateCache();
    }
}; 

function CTLText( oParentContainer, 
                    x, y, iWidth, iHeight, 
                    iFontSize, szAlign, szColor, szFont,iLineHeightFactor,
                    iPaddingH, iPaddingV,
                    szMsg, 
                    bFitText, bVerticalAlign, bMultiline, 
                    bDebug, 
                    iMinTextSize = 11, bEllipsis = false){

    this._oContainer = new createjs.Container();
    this._oContainer.x = x;
    this._oContainer.y = y;

    if (oParentContainer) {
        this.setParentContainer(oParentContainer);
    }

    this._iOutline = 0;

    this._iWidth  = iWidth;
    this._iHeight = iHeight;
    
    this._bMultiline = bMultiline;

    this._iFontSize = iFontSize;
    this._iStartingFontSize = iFontSize;
    this._szAlign   = szAlign;
    this._szColor   = szColor;
    this._szFont    = szFont;

    this._iPaddingH = iPaddingH;
    this._iPaddingV = iPaddingV;

    this._iEffectiveWidth = this._iWidth-this._iPaddingH*2;
    this._iEffectiveHeight = this._iHeight-this._iPaddingV*2;

    this._bVerticalAlign = bVerticalAlign;
    this._bFitText       = bFitText;
    this._iMinTextSize   = iMinTextSize;
    this._bDebug         = bDebug;
    // this._bDebug         = true;

    this._bEllipsis = bEllipsis;

    this._bMandatoryCache = false;
    this._bCacheActive = false;
    this._fCacheScale;

    // RESERVED
    this._oDebugShape = null; 
    this._fLineHeightFactor = iLineHeightFactor;
    
    this._oText = null;

    this.__setMsg(szMsg);
    this.__createText();
}
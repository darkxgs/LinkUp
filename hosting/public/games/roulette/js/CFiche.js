function CFiche(iXPos,iYPos,iIndexFicheSelected,oParentContainer,iScale){
    var _iValue;
    var _pStartingPoint;
    var _pEndingPoint;
    var _oSprite;
    var _oTextValue;
    var _oContainer;
    var _oParentContainer = oParentContainer;
    
    this._init = function(iXPos,iYPos,iIndexFicheSelected,iScale){
        _oContainer = new createjs.Container();
        _oContainer.x = iXPos+7;
        _oContainer.y = iYPos+7;
        _oParentContainer.addChild(_oContainer);
        
        var oSprite = s_oSpriteLibrary.getSprite("fiche_"+iIndexFicheSelected)
        
        _oContainer.regX = oSprite.width/2;
        _oContainer.regY = oSprite.height/2;
        
        _oSprite = createBitmap(oSprite);
        
        if(iScale){
            _oSprite.scaleX = iScale;
            _oSprite.scaleY = iScale;
        }else{
            _oSprite.scaleX = 0.8;
            _oSprite.scaleY = 0.8;
            iScale=0.8;
        }
        
        _iValue = iIndexFicheSelected;
        
        _oContainer.addChild(_oSprite);
        
        var szValue = s_oGameSettings.getFicheValues(iIndexFicheSelected);
        var szValueText = szValue;
        if (szValue >= 1000) {
            szValueText = (szValue / 1000) + "K";
        }

        var cX = (oSprite.width * iScale) / 2;
        var cY = (oSprite.height * iScale) / 2;

        var oWhiteCircle = new createjs.Shape();
        var iRadius = 11 * iScale;
        oWhiteCircle.graphics.beginFill("#ffffff").drawCircle(cX, cY, iRadius);
        _oContainer.addChild(oWhiteCircle);

        var iTextSize = 22 * iScale;
        _oTextValue = new CTLText(_oContainer, 
                    cX - iTextSize/2, cY - iTextSize/2, iTextSize, iTextSize, 
                    14 * iScale, "center", "#000000" , FONT1, 1,
                    0, 0,
                    szValueText,
                    true, true, false,
                    false );
    };

    this.setEndPoint =  function(pEndX,pEndY){
        _pStartingPoint=new createjs.Point(_oContainer.x,_oContainer.y);
        _pEndingPoint=new createjs.Point(pEndX,pEndY);
    };
		
    this.updatePos = function(fLerp){
        var oPoint = new createjs.Point();
        
        oPoint = s_oTweenController.tweenVectors(_pStartingPoint, _pEndingPoint, fLerp,oPoint );
        _oContainer.x = oPoint.x;
        _oContainer.y = oPoint.y;
    };
    
    this.getSprite = function(){
        return _oContainer;
    };
    
    this.getValue = function(){
        return _iValue;
    };

    this._init(iXPos,iYPos,iIndexFicheSelected,iScale);
}
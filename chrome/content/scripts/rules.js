/* 
 * Zemanta Rules related functions
 *
 * Copyright (C) Zemanta. See license.txt bundled for full license.
 */
 
Zemanta.Rules = new function()
{
    this.DIRECTORY_TYPE = Components.interfaces.nsIFile.DIRECTORY_TYPE;

    this._thexml = null;
    this._thexmlDOM = null;
    this.rRxArray = [];
    this.rUrlArray = [];
    this.rNameArray = [];
}

/* Send a request to get the rules file */
Zemanta.Rules.getRulesFile = function()
{
    var observerId = Zemanta._service.registerObserver({
        notify: function(event)
        {
            if (event.getType() == Zemanta.RPC.Constants.ZEMANTA_RPC_EVENT_TYPE_ZEMANTA_RPC_GET_RULES_ACTION_COMPLETE)
            {
                Zemanta._service.unregisterObserver(observerId);

                if (event.isError())
                {
                    Zemanta.Logger.error("RPC error: '" + event.getError().getMessage() + "'");
                    // show a generic error message ?
                    Zemanta.Logger.debug("There was a problem getting the Rules file, trying for cached version.");
                }
                else
                {
                    Zemanta.Logger.debug("Get Rules File complete");
                    var theXML = event.getData();
                    var oSerializer = new XMLSerializer();
                    var xmlstring = oSerializer.serializeToString(theXML);
                    Zemanta.Logger.debug("xml = '" + xmlstring + "'");
                    // Write valid XML before stripping out xml dec
                    Zemanta.Rules.writeRulesFile(xmlstring);
                    Zemanta.Rules._thexml = xmlstring;
                    Zemanta.Rules._thexml = Zemanta.Rules._thexml.replace('<?xml version="1.0" encoding="UTF-8"?>', "");
                    var oParser = new DOMParser();
                    Zemanta.Rules._thexmlDOM = oParser.parseFromString(Zemanta.Rules._thexml, "text/xml");
                }
                // Handle data from the Rules immediately after we get it back and it has been saved
                Zemanta.setReleaseId();
            }
        }
    });

    Zemanta._service.getRulesFile();
}

/*  Write the rules file to disk */
Zemanta.Rules.writeRulesFile = function(theXML)
{
    var file = Zemanta.Util.getProfileFolder();
    file.append("Zemanta");
    if( !file.exists() || !file.isDirectory() )
    {
        // if it doesn't exist, create
        file.create(this.DIRECTORY_TYPE, 0777);
    }
    file.append("rules.xml");

    try {
        // file is nsIFile, data is a string
        var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
                                .createInstance(Components.interfaces.nsIFileOutputStream);

        // 0x02 write only, 0x08 create if necessary, 0x20 truncate to 0
        foStream.init(file, 0x02 | 0x08 | 0x20, 0666, 0);
        // Put back in XML declaration that was stripped out during request response processing
        var stringToWrite = '<?xml version="1.0" encoding="UTF-8"?>' + "\n" + theXML + "\n";
        foStream.write(stringToWrite, stringToWrite.length);
        foStream.close();
    }
    catch(e) {
        Zemanta.Logger.error("Writing rules file failed : " + e);
    }
}

/*  Read the rules file from disk */
Zemanta.Rules.readRulesFile = function()
{
    var file = Zemanta.Util.getProfileFolder();
    file.append("Zemanta");
    file.append("rules.xml");
    if(!file.exists())
    {
        return "";
    }

    var data = "";
    try {
        var fstream = Components.classes["@mozilla.org/network/file-input-stream;1"]
                                .createInstance(Components.interfaces.nsIFileInputStream);
        var sstream = Components.classes["@mozilla.org/scriptableinputstream;1"]
                                .createInstance(Components.interfaces.nsIScriptableInputStream);
        fstream.init(file, -1, 0, 0);
        sstream.init(fstream); 

        var str = sstream.read(4096);
        while (str.length > 0) {
          data += str;
          str = sstream.read(4096);
        }

        data = data.replace('<?xml version="1.0" encoding="UTF-8"?>', "");

        sstream.close();
        fstream.close();
        Zemanta.Logger.debug("Reading rules file locally succeeded");
    }
    catch(e) {
        Zemanta.Logger.error("Reading rules file locally failed : " + e);
    }
    if (data == "")
        return null;
    else {
        var oParser = new DOMParser();
        return oParser.parseFromString(data, "text/xml");
    } 
    //return (data == "") ? null : new XML(data);
}

/* Get the rules file locally and return as (e4x) XML */
Zemanta.Rules.getRulesXML = function()
{
    Zemanta.Logger.info("Getting rules XML");
    var rules = Zemanta.Rules._thexmlDOM;
    if (rules == null) {
        rules = Zemanta.Rules.readRulesFile();
        Zemanta.Rules._thexmlDOM = rules;
    }
    return rules;
}

/* Compile the regEx of rules that will be used to chack against page (urls) loading */
Zemanta.Rules.setupRulesRegexArray = function()
{
    Zemanta.Logger.info(Zemanta.Rules.rRxArray.length);
    if (Zemanta.Rules.rRxArray && Zemanta.Rules.rRxArray.length > 0) // already done, bail
        return;

    Zemanta.Logger.info("Compiling rules Regex array");
    // Resets, to be sure
    Zemanta.Rules.rRxArray = [];
    Zemanta.Rules.rUrlArray = [];
    Zemanta.Rules.rNameArray = [];
    Zemanta.Rules.rTypeArray = [];

    var i = 0;
    var thexml = Zemanta.Rules.getRulesXML();
    if (thexml && thexml != "")
    {
        var rules = thexml.getElementsByTagName("rule");
        // Load the rules backwards as more general ones are first and the order can not be changed
        for (var j = rules.length - 1; j > 0; j--)
        {
            var regexps = rules[j].getElementsByTagName("regexp");
            for (var k = 0; k < regexps.length; k++)
            {
                var re = new RegExp(regexps[k].firstChild.nodeValue, "i");
                Zemanta.Rules.rRxArray[i] = re;
                Zemanta.Logger.info("url = "+rules[j].getElementsByTagName("url")[0].firstChild.nodeValue);
                Zemanta.Rules.rUrlArray[i] = rules[j].getElementsByTagName("url")[0].firstChild.nodeValue;
                Zemanta.Rules.rNameArray[i] = rules[j].getElementsByTagName("name")[0].firstChild.nodeValue;
                Zemanta.Rules.rTypeArray[i] = rules[j].getAttribute("type");
                i++;
            }
        }
    }
}

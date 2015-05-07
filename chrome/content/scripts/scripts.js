/*
 * Handling of scripts defined in rules.xml
 *
 * Copyright (C) Zemanta. See license.txt bundled for full license.
 */

Zemanta.Scripts = new function()
{
    this.script = null;
}

Zemanta.Scripts.getScriptFileURI = function(script)
{
    Zemanta.Logger.debug("Zemanta.getScriptFileURI. Filename = "+script);
    var hostEnvInfo = Zemanta.Util.getHostEnvironmentInfo();
    var file = this.getScriptDir(hostEnvInfo.appName);
    file.append(script);
    return Components.classes["@mozilla.org/network/io-service;1"]
                     .getService(Components.interfaces.nsIIOService)
                     .newFileURI(file);
}

Zemanta.Scripts.getScriptDir = function(aAppName)
{
    var dir = Zemanta.Util.getProfileFolder();
    dir.append("Zemanta");
    dir.append("Scripts");
    if( !dir.exists() || !dir.isDirectory() )
    {
        // if it doesn't exist, create
        dir.create(Components.interfaces.nsIFile.DIRECTORY_TYPE, 0777);
    }

    return dir;
}

/*  Write the script file to disk */
Zemanta.Scripts.writeScriptFile = function(theJS, aName)
{
    Zemanta.Logger.debug("Zemanta.writeScriptFile. Filename = "+aName);
    var file = this.getScriptDir();
    file.append(aName);

    try {
        // file is nsIFile, data is a string
        var foStream = Components.classes["@mozilla.org/network/file-output-stream;1"]
                                .createInstance(Components.interfaces.nsIFileOutputStream);

        // 0x02 write only, 0x08 create if necessary, 0x20 truncate to 0
        foStream.init(file, 0x02 | 0x08 | 0x20, 0666, 0);
        foStream.write(theJS, theJS.length);
        foStream.close();
    }
    catch(e) {
        Zemanta.Logger.error("Writing script file failed : " + e);
    }
}

/*  This files gets called in a callback when all script files are on disk */
Zemanta.Scripts.scriptFilesDone = function()
{
    try {
        var zemSvc = Components.classes["@zemanta.com/zemanta-service;1"]
                                        .getService(Components.interfaces.zemIZemantaService);
        zemSvc.handleScript(this.script);
    }
    catch(e) {
        //@@TODO, if we can't get the component service, the extension is pretty useless
        //Better error handling here
        Zemanta.Logger.error("Could not initialise zemantaService : "+e);
    }
}

Zemanta.Scripts.getContents = function(aURL, charset)
{
    Zemanta.Logger.debug("Zemanta.Scripts.getContents : " + aURL.spec);
    if( !charset ) {
        charset = "UTF-8"
    }
    var ioService=Components.classes["@mozilla.org/network/io-service;1"]
        .getService(Components.interfaces.nsIIOService);
    var scriptableStream=Components
        .classes["@mozilla.org/scriptableinputstream;1"]
        .getService(Components.interfaces.nsIScriptableInputStream);
    var unicodeConverter = Components
        .classes["@mozilla.org/intl/scriptableunicodeconverter"]
        .createInstance(Components.interfaces.nsIScriptableUnicodeConverter);
    unicodeConverter.charset = charset;

    var channel=ioService.newChannelFromURI(aURL);
    var input=channel.open();
    scriptableStream.init(input);
    var str=scriptableStream.read(input.available());
    scriptableStream.close();
    input.close();

    try {
        return unicodeConverter.ConvertToUnicode(str);
    } catch( e ) {
        return str;
    }
}

#!/bin/sh

[ -f zemanta.xpi ] && rm zemanta.xpi;

zip -r9 zemanta.xpi license.txt chrome.manifest install.rdf defaults/ chrome/ components/ loader/ -x \*.git/* -x \*.tern-port
printf "build finished.\n";


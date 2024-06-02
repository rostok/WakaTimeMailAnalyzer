# WakaTimeMailAnalyzer
This NodeJS script will connect to IMAP mailbox and parse all WakaTime weekly emails. Parsed data is accumulated into multiple area charts.

To use please create credentials.js with following contents:
```
module.exports = {
    inbox: '<imap inbox folder>',
    user: '<mailbox name>',
    password: '<your password>', // leave empty if afraid
    host: '<imap server address>'
}
```

Projects (or other sets) can be merge into single group using rename.js. Below is an example of how 3 diffrent projects can be merge into single one.
```
module.exports = {
    "Projects" : {
      "megaopus-front" : "megaopus",
      "megaopus-back" : "megaopus",
      "megaopus-db" : "megaopus",
   }
}
```
In addition projects can be filtered by total time spent. This is set via ```config.filterMinimalHours``` variable.


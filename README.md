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

In addition projects can be filtered by total time spent. This is set via ```config.filterMinimalHours``` variable.


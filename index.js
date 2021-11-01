process.env["NODE_TLS_REJECT_UNAUTHORIZED"] = 0;

var math = require('mathjs');
var imaps = require('imap-simple');
var fs = require('fs');
var opn = require('opn');
var credentials = require('./credentials');

var config = {
  inbox: credentials.inbox,
  templates: [
    "chart.html",
    "chart-nv.html",
  ],
  sets: [
    "Projects",
    "Languages",
    "Editors",
    "Operating Systems",
    "Machines",
    "Categories",
  ],
  filterMinimalHours: 4,
  debug: process.argv.join(' ').includes(" -debug"),
  imap: {
    user: credentials.user,
    password: credentials.password,
    host: credentials.host,
    port: 993,
    tls: true,
    authTimeout: 10000
  }
};

// in case password is empty ask for it safely
if (config.imap.password == '') {
  var readlineSync = require('readline-sync');
  config.imap.password = readlineSync.question('inbox password:', {
    hideEchoBack: true
  });
}

// this will hold all sets (projects, languages, ...), single project has 'total' property with total number of hours and week-end dates properties with hours spend on that weeks  
var data = {};

// silly little function
function betw(src, beg, end) {
  if (!src.includes(beg)) return '';
  src = src.split(beg);
  if (src.length <= 1) return src[0];
  src.shift();
  src = src.join("beg");
  src = src.split(end);
  return src[0];
}

console.log("connecting.");
imaps.connect(config).then(function (connection) {

  return connection.openBox(config.inbox).then(function () {
    console.log("connected.");
    var searchCriteria = [
      ['FROM', 'WakaTime'],
      ['SUBJECT', 'weekly'],
      //      ['SUBJECT', 'WakaTime'],
      ['!SUBJECT', 'no coding activity']
    ];

    var fetchOptions = {
      bodies: ['HEADER', 'TEXT'],
      markSeen: false
    };

    return connection.search(searchCriteria, fetchOptions).then(function (results) {
      console.log("searching.");
      results.map(function (res) {
        var s = res.parts.filter(function (part) {
          return part.which === 'HEADER';
        })[0].body.subject[0];

        if (config.debug) console.log(s + " / " + res.attributes.date.toISOString());
        var t = res.parts.filter(function (part) {
          return part.which === 'TEXT';
        })[0].body;

        var w = s.split("until").pop().trim();
        config.sets.forEach(set => {
          if (typeof data[set] === 'undefined') data[set] = {};
          p = betw(t, set + ':', '\r\n\r\n').trim();
          p = p.split("\n");
          p.map(pr => {
            pr = pr.trim();
            var d = [];
            if (pr.indexOf("\t") != -1) {
              d = pr.split("\t");
            } else
            if (pr.indexOf(" : ") != -1) {
              d = pr.split(" : ");
            } else
              return;
            d[0] = d[0].replace("'", "");
            d[0] = d[0].replace('"', "");
            var q = d[1];
            q = q.replace("hrs", "*60*60+");
            q = q.replace("hr", "*60*60+");
            q = q.replace("mins", "*60+");
            q = q.replace("min", "*60+");
            q = q.replace("secs", "+");
            q = q.replace("sec", "+");
            q += "0";
            d[1] = math.eval(q) / 3600;
            if (typeof data[set][d[0]] === 'undefined') data[set][d[0]] = {
              total: 0
            };
            data[set][d[0]].total += d[1];
            data[set][d[0]][w] = d[1];
            if (config.debug) console.log("\t" + d[0] + ":" + d[1]);
          })
        });
      });
    }).then(() => {
      // console.log(JSON.stringify(data.Projects,null,2));
      // fs.writeFileSync("datap.js", JSON.stringify(data.Projects,null,2), {flag: "w"});
      // fs.writeFileSync("dataall.js", JSON.stringify(data,null,2), {flag: "w"});
      // process.exit();
      console.log("accumulating.");

      var out = {};
      config.sets.forEach(set => {
        out[set] = [];
        var weeks = Object.keys(data[set]);
        weeks = weeks.reduce((arr, val) => {
          return arr.concat(Object.keys(data[set][val]));
        }, []);
        weeks = weeks.filter((v, i, a) => a.indexOf(v) === i);
        weeks = weeks.filter(v => v != 'total').sort();

        header = Object.keys(data[set]).sort().filter(p => data[set][p].total > config.filterMinimalHours);
        projectNames = header.concat();
        header = header.map(p => p + " : " + Number((data[set][p].total).toFixed(1)));
        header.unshift('week');
        out[set].push(header);

        header = header.map(p => `"${p}"`).join(',');
        weeks.map(w => {
          var oneWeek = [];
          oneWeek.push(w);

          projectNames.map(pn => {
            var tot = data[set][pn][w];
            if (tot == undefined) tot = 0;
            oneWeek.push(tot);
          });
          out[set].push(oneWeek);
        });
      });
      fs.writeFileSync("data.js", "var data = " + JSON.stringify(out, null, 2) + ";", { flag: "w" });

      config.templates.forEach(t => {
        if (fs.existsSync(t)) {
          opn(__dirname + t, {
            app: 'chrome'
          }).then(() => {});
        } else {
          console.error(t + " does not exist");
        }
      });
      process.exit();
    });
  });
});
var path = require('path');
var fs = require('fs');

var _ = require('lodash');
var moment = require('moment-timezone');
var uuid = require('node-uuid');

var DEFAULTS = {
  filename: 'event'
};

function ICS(options) {
  this.options = _.merge({}, DEFAULTS, options);
}

function buildEvent(attributes) {
  if (!attributes || _.isEmpty(attributes)) {
    return buildDefaultEvent();
  } else {
    return _.compact([
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'CALSCALE:GREGORIAN',
      'PRODID:-//Adam Gibbons//agibbons.com//ICS: iCalendar Generator'
    ]
    .concat(defineTimeZone(attributes))
    .concat([
      'BEGIN:VEVENT',
      generateUID(),
      'DTSTAMP:' + generateDateTimeStamp(),
      formatDTSTART(attributes.start, attributes.timeZone),
      formatDTEND(attributes.start, attributes.end, attributes.timeZone, attributes.timeZoneEnd),
      formatProperty('SUMMARY', attributes.title),
      formatProperty('DESCRIPTION', attributes.description),
      formatProperty('LOCATION', attributes.location),
      formatProperty('URL', attributes.url),
      formatStatus(attributes.status),
      formatGeo(attributes.geo)
    ])
    .concat(formatAttendees(attributes))
    .concat(formatCategories(attributes))
    .concat(formatAttachments(attributes))
    .concat(formatAlarms(attributes))
    .concat(['END:VEVENT', 'END:VCALENDAR'])).join('\r\n');
  }

  function buildDefaultEvent() {
    var file = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'CALSCALE:GREGORIAN',
      'PRODID:-//Adam Gibbons//agibbons.com//ICS: iCalendar Generator',
      'BEGIN:VEVENT',
      generateUID(),
      'DTSTAMP:' + generateDateTimeStamp(),
      'END:VEVENT',
      'END:VCALENDAR'
    ].join('\r\n');

    return file;
  }

  function generateUID() {
    return 'UID:' + uuid.v1();
  }

  function setFileExtension(dest) {
    return dest.slice(-4) === '.ics' ? dest : dest.concat('.ics');
  }

  // Follow ISO 8601 string rules:
  // If `start` contains an uppercase T or a space,
  // it's a date-time; otherwise, it's just a date.
  function formatDTSTART(string, tz) {

    if (!string) {
      return 'DTSTART:' + moment().format('YYYYMMDD');
    }

    if (tz) {
      return 'DTSTART;TZID=' + tz + ':' + moment(string).format('YYYYMMDDTHHmm00');
    }

    if (isDateTime(string) && moment.parseZone(string).utcOffset() === 0) {
      return 'DTSTART:' + moment(string).format('YYYYMMDDTHHmm00');
    }

    if (isDateTime(string)) {
      return moment(string).format('YYYYMMDDTHHmm00') + 'Z';
    }

    return 'DTSTART;VALUE=DATE:' + moment(string).format('YYYYMMDD');
  }

  function formatDTEND(startString, endString, tz, tzEnd) {

    if (!startString) {
      return 'DTEND:' + moment().add(1, 'days').format('YYYYMMDD');
    }

    if (tz && !tzEnd && !endString) {
      return 'DTEND;TZID=' + tz + ':' + moment(startString).format('YYYYMMDDTHHmm00');
    }

    if (tz && !tzEnd && endString) {
      return 'DTEND;TZID=' + tz + ':' + moment(endString).format('YYYYMMDDTHHmm00');
    }

    if (tz && tzEnd && endString) {
      return 'DTEND;TZID=' + tzEnd + ':' + moment(endString).format('YYYYMMDDTHHmm00');
    }

    if (endString && !isDateTime(startString)) {
      return 'DTEND;VALUE=DATE:' + moment(endString).format('YYYYMMDD');
    }

    if (endString && isDateTime(startString)) {
      return 'DTEND:' + moment(endString).format('YYYYMMDDTHHmm00');
    }

    if (!endString && !isDateTime(startString)) {
      return 'DTEND;VALUE=DATE:' + moment(startString).add(1, 'days').format('YYYYMMDD');
    }

    if (!endString && isDateTime(startString) && moment.parseZone(startString).utcOffset() === 0) {
      return 'DTEND:' + moment(startString).format('YYYYMMDDTHHmm00');
    }
  }

  function isDateTime(string) {
    return ['T', ' '].some(function (char) {
      return string.search(char) !== -1;
    });
  }

  function generateDateTimeStamp() {
    return moment().utc().format('YYYYMMDDTHHmmss') + 'Z';
  }

  function formatProperty(key, value) {
    if (value) {
      return key + ':' + value;
    }

    return null;
  }

  function formatAttachments(attributes) {
    if (attributes.attachments) {
      return attributes.attachments.map(function (path) {
        return 'ATTACH:' + path;
      });
    }
    return null;
  }

  function formatAttendees(attributes) {
    if (attributes.attendees) {
      return attributes.attendees.map(function (attendee) {
        if (attendee.name && attendee.email) {
          return 'ATTENDEE;CN=' + attendee.name + ':mailto:' + attendee.email;
        }
        return null;
      });
    }

    return null;
  }

  function formatCategories(attributes) {
    if (attributes.categories) {
      return 'CATEGORIES:' + attributes.categories.join(',');
    }

    return null;
  }

  function formatGeo(geo) {
    if (geo && geo.lat && geo.lon) {
      return 'GEO:' + parseFloat(geo.lat) + ';' + parseFloat(geo.lon);
    }

    return null;
  }

  function formatStatus(status) {
    if (status && ['TENTATIVE', 'CONFIRMED', 'CANCELLED'].indexOf(status.toUpperCase()) !== -1) {
      return 'STATUS:' + status;
    }

    return null;
  }

  function defineTimeZone(attributes) {
    // probs make this a switch statement...
    switch (attributes.timeZone) {
      case 'America/New_York':
        return [
          'BEGIN:VTIMEZONE',
          'TZID:America/New_York',
          'BEGIN:STANDARD',
          'DTSTART:20071104T020000',
          'RRULE:FREQ=YEARLY;BYMONTH=11;BYDAY=1SU',
          'TZOFFSETFROM:-0400',
          'TZOFFSETTO:-0500',
          'TZNAME:EST',
          'END:STANDARD',
          'BEGIN:DAYLIGHT',
          'DTSTART:20070311T020000',
          'RRULE:FREQ=YEARLY;BYMONTH=3;BYDAY=2SU',
          'TZOFFSETFROM:-0500',
          'TZOFFSETTO:-0400',
          'TZNAME:EDT',
          'END:DAYLIGHT',
          'END:VTIMEZONE'
        ];
        break;
      // case 'Ameria/Chicago':
      default:
        return null;
    }
  }

  function formatAlarms(attributes) {
    if (attributes.alarms) {
      return attributes.alarms.map(function (alarm) {
        return formatAlarm(alarm);
      });
    }
    return null;
  }

  function formatAlarm(alarm) {
    if (alarm && alarm.action) {
      // switch on the action verb
      var action;
      var trigger;
      switch (alarm.action) {
        case 'audio':
          // TODO action = formatAlarmAudioAction(alarm.attachment, alarm.duration, alarm.repeat);
          // but for now...
          return null;
          break;
        case 'display':
          action = formatAlarmDisplayAction(alarm.description, alarm.duration, alarm.repeat);
          break;
        case 'email':
          // TODO action = formatAlarmEmailAction(alarm.description, alarm.summary, alarm.attendees, alarm.attachments, alarm.duration, alarm.repeat);
          // but for now...
          return null;
          break;
        default:
          return null;
      }
      // if action didn't work out, bail
      if (!action) return null;
      // check for valid trigger
      if (alarm.trigger) {
        // TODO process the trigger
      }
      if (!trigger) {
        // if no trigger was provided or was invalid
        // provide a default trigger of 15 minutes before the start
        trigger = 'TRIGGER:-PT15M'
      }
      return [
        'BEGIN:VALARM',
        trigger,
        action,
        'END:VALARM'
      ].join('\r\n');
    }

    return null;
  }

  function formatAlarmDisplayAction(description, duration, repeat) {
    var action = [];
    // if there is no description the action is invalid
    if (!description) return null;
    action.push('ACTION:DISPLAY');
    action.push('DESCRIPTION:' + description);
    // both duration and repeat must be specified in order to be valid
    if (duration && repeat) {
      // TODO add output for Duration and Repeat properties
    }

    return action.join('\r\n');
  }
}

ICS.prototype.buildEvent = function(attributes) {
  return buildEvent(attributes);
};

ICS.prototype.getDestination = function(_filepath_) {
  var filepath = _filepath_ || this.options.filename + '.ics';
  var fileObj = path.parse(filepath);
  var result = path.resolve(process.cwd(), fileObj.dir, fileObj.name + '.ics');

  return result;
};

ICS.prototype.createEvent = function(attributes, _options_, cb) {
  var options = arguments.length === 3 ? _.merge(this.options, _options_) : this.options
  ,   file = this.buildEvent(attributes)
  ,   destination = this.getDestination(options.filepath)
  ,   cb = arguments.length === 3 ? cb : _options_;

  fs.writeFile(destination, file, function (err, data) {
    if (err) return cb(err);
    return cb(null, file);
  });
};

module.exports = ICS;

/**
 * `list` type prompt
 */

var _ = require("lodash");
var util = require("util");
var chalk = require("chalk");
var figures = require("figures");
var Base = require("./base");
var observe = require("../utils/events");


/**
 * Module exports
 */

module.exports = Prompt;


/**
 * Constructor
 */

function Prompt() {
  Base.apply( this, arguments );

  if (!this.opt.choices) {
    this.throwParamError("choices");
  }

  if ( _.isArray(this.opt.default) ) {
    this.opt.choices.forEach(function( choice ) {
      if ( this.opt.default.indexOf(choice.value) >= 0 ) {
        choice.checked = true;
      }
    }, this);
  }

  this.firstRender = true;
  this.pointer = 0;

  this.opt.choices.setRender( renderChoices );

  // Make sure no default is set (so it won't be printed)
  this.opt.default = null;

  return this;
}
util.inherits( Prompt, Base );


/**
 * Start the Inquiry session
 * @param  {Function} cb      Callback when prompt is done
 * @return {this}
 */

Prompt.prototype._run = function( cb ) {
  this.done = cb;

  var events = observe(this.rl);

  var validation = this.handleSubmitEvents( events.line );
  validation.success.forEach( this.onEnd.bind(this) );
  validation.error.forEach( this.onError.bind(this) );

  events.normalizedUpKey.takeUntil( validation.success ).forEach( this.onUpKey.bind(this) );
  events.normalizedDownKey.takeUntil( validation.success ).forEach( this.onDownKey.bind(this) );
  events.numberKey.takeUntil( validation.success ).forEach( this.onNumberKey.bind(this) );
  events.spaceKey.takeUntil( validation.success ).forEach( this.onSpaceKey.bind(this) );

  // Init the prompt
  this.hideCursor();
  this.render();

  return this;
};


/**
 * Render the prompt to screen
 * @return {Prompt} self
 */

Prompt.prototype.render = function(error) {
  // Render question
  var cursor = 0;
  var message = this.getQuestion();
  var choicesStr = "\n" + this.opt.choices.render( this.pointer );

  if ( this.firstRender ) {
    message += "(Press <space> to select)";
  }

  // Render choices or answer depending on the state
  if ( this.status === "answered" ) {
    message += chalk.cyan( this.selection.join(", ") );
  } else {
    message += choicesStr;
  }

  if (error) {
    message += '\n' + chalk.red('>> ') + error;
    cursor++;
  }

  this.firstRender = false;

  this.screen.render(message, { cursor: cursor });
};


/**
 * When user press `enter` key
 */

Prompt.prototype.onEnd = function( state ) {

  this.status = "answered";

  // Rerender prompt (and clean subline error)
  this.render();

  this.screen.done();
  this.showCursor();
  this.done( state.value );
};

Prompt.prototype.onError = function ( state ) {
  this.render(state.isValid);
};

Prompt.prototype.getCurrentValue = function () {
  var choices = this.opt.choices.filter(function( choice ) {
    return !!choice.checked && !choice.disabled;
  });

  this.selection = _.pluck(choices, "name");
  return _.pluck(choices, "value");
};

Prompt.prototype.onUpKey = function() {
  var len = this.opt.choices.realLength;
  this.pointer = (this.pointer > 0) ? this.pointer - 1 : len - 1;
  this.render();
};

Prompt.prototype.onDownKey = function() {
  var len = this.opt.choices.realLength;
  this.pointer = (this.pointer < len - 1) ? this.pointer + 1 : 0;
  this.render();
};

Prompt.prototype.onNumberKey = function( input ) {
  if ( input <= this.opt.choices.realLength ) {
    this.pointer = input - 1;
    this.toggleChoice( this.pointer );
  }
  this.render();
};

Prompt.prototype.onSpaceKey = function( input ) {
  this.toggleChoice(this.pointer);
  this.render();
};

Prompt.prototype.toggleChoice = function( index ) {
  var checked = this.opt.choices.getChoice(index).checked;
  this.opt.choices.getChoice(index).checked = !checked;
};


/**
 * Function for rendering checkbox choices
 * @param  {Number} pointer Position of the pointer
 * @return {String}         Rendered content
 */

function renderChoices( pointer ) {
  var output = "";
  var separatorOffset = 0;

  this.choices.forEach(function( choice, i ) {
    if ( choice.type === "separator" ) {
      separatorOffset++;
      output += " " + choice + "\n";
      return;
    }

    if ( choice.disabled ) {
      separatorOffset++;
      output += " - " + choice.name;
      output += " (" + (_.isString(choice.disabled) ? choice.disabled : "Disabled") + ")";
    } else {
      var isSelected = (i - separatorOffset === pointer);
      output += isSelected ? chalk.cyan(figures.pointer) : " ";
      output += getCheckbox( choice.checked, choice.name );
    }

    output += "\n";
  }.bind(this));

  return output.replace(/\n$/, "");
}

/**
 * Get the checkbox
 * @param  {Boolean} checked - add a X or not to the checkbox
 * @param  {String}  after   - Text to append after the check char
 * @return {String}          - Composited checkbox string
 */

function getCheckbox( checked, after ) {
  var checked = checked ? chalk.green( figures.radioOn ) : figures.radioOff;
  return checked + " " + ( after || "" );
}

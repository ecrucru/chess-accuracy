
//==================================================
// Chess accuracy
// Copyright (C) 2020, ecrucru
// https://github.com/ecrucru/chess-accuracy/
// License AGPL v3
//==================================================

"use strict";

String.prototype.replaceAll = function (pS, pR) { return this.split(pS).join(pR); };

var SF = null;

function chess_accuracy()
{
	//-- Technical check
	if (!window.Worker)
	{
		alert('The WebWorkers are not supported by your browser.');
		return false;
	}

	//-- Verify that the analysis is not running yet
	if (SF != null)
	{
		alert('An analysis is running.');
		return false;
	}		

	//-- Fetch the inputs
	var	i,
		headers = {},
		ep = document.getElementById('chess_progress'),
		ew = document.getElementById('chess_white'),
		eb = document.getElementById('chess_black'),
		input = document.getElementById('chess_input').value.replaceAll("\t", ' ').replaceAll("\r", '').trim();

	//-- Extract the headers
	var	list, item, rxp;
	list = input.split("\n");
	for (i=0 ; i<list.length ; i++)
	{
		item = list[i].trim();

		//- Header
		rxp = item.match(/^\[(\w+)\s+\"(.*)\"\]$/);
		if (rxp != null)
		{
			headers[rxp[1]] = rxp[2];
			continue;
		}

		//- Item
		if (!item.startsWith('['))
		{
			list.splice(0, i);
			input = list.join("\n");
			break;
		}
	}

	//-- Extract the individual moves
	var ilen, b1, b2;
	input = input.replaceAll("\n", ' ').replaceAll('...', '.').replaceAll('.', '. ');
	input = input.replace(/\{[^\}]+\}/g, ' ');				// Kick the comments
	ilen = input.length;
	while (true)											// Kick the analysis lines
	{
		input = input.replace(/(\([^\(\)]+\))/g, ' ');
		if (input.length == ilen)
			break;
		ilen = input.length;
	}
	input = input.replace(/\s+/g, ' ').trim().split(' ');
	for (i=input.length-1 ; i>=0 ; i--)
	{
		if (input[i].match(/^[0-9]+\.*$/) ||
			input[i].startsWith('$') ||
			(['1-0', '0-1', '1/2-1/2'].indexOf(input[i]) != -1) ||
			(input[i] == '')
		)
			input.splice(i, 1);
	}
	ep.innerHTML = '-';
	ew.innerHTML = '-';
	eb.innerHTML = '-';
	if (input.length == 0)
	{
		alert('The input PGN is invalid.');
		return false;
	}

	//-- Initialize the objects
	SF = new Worker('./stockfish.js');
	SF.stop = false;
	SF.white = 0;
	SF.black = 0;
	SF.moves = input.slice(0);
	SF.moveId = -1;
	SF.depth = Math.max(1, Math.min(32, document.getElementById('chess_depth').value));
	SF.time = 1000 * Math.max(1, Math.min(64, document.getElementById('chess_time').value));
	SF.side = document.getElementById('chess_side').value;
	SF.board = new Chess('FEN' in headers ? headers.FEN : 'rnbqkbnr/pppppppp/8/8/8/8/PPPPPPPP/RNBQKBNR w KQkq - 0 1');
	SF.board.moveUci = function(p) {
		var promo = p.substring(4,5);
		return this.move({	from      : p.substring(0,2),
							to        : p.substring(2,4),
							promotion : (promo.length == 1 ? promo : 'q')
						});
	};

	//-- Calculate the accuracy
	SF.nextMove = function() {
		//- Handle the stop request
		if (this.stop)
		{
			ep.innerHTML = 'interrupted';
			ew.innerHTML = this.white + ' ...';
			eb.innerHTML = this.black + ' ...';
			this.terminate();
			SF = null;
			return;
		}

		//- Set the cursor
		this.moveId++;
		ep.innerHTML = (100 * this.moveId / this.moves.length).toFixed(0) + ' % ('+Math.min(this.moveId+1,this.moves.length)+'/'+this.moves.length+')';
		if (this.moveId > this.moves.length-1)
		{
			ew.innerHTML = this.white + ' (' + (100.0 * this.white / (this.moves.length / 2.0)).toFixed(1) + ' %)';
			eb.innerHTML = this.black + ' (' + (100.0 * this.black / (this.moves.length / 2.0)).toFixed(1) + ' %)';
			this.terminate();
			SF = null;
			alert('The analysis is complete.');
			return;
		}

		//- Send the current position
		if (this.side.indexOf(this.board.turn()) == -1)
		{
			this.board.move(this.moves[this.moveId]);
			this.nextMove();
		}
		else
		{
			this.postMessage('uci');
			this.postMessage('setoption name Clear Hash');
			this.postMessage('setoption name UCI_AnalyseMode value true');
			this.postMessage('isready');
			this.postMessage('ucinewgame');
			this.postMessage('position fen '+this.board.fen());
			this.postMessage('go depth '+this.depth+' movetime '+this.time);
		}
	};
	SF.onmessage = function onmessage(event) {
		var	list = event.data.split(' '),
			ai, human;
		if (list[0] == 'bestmove')
		{
			//- Play AI
			this.board.moveUci(list[1]);
			ai = this.board.fen();
			this.board.undo();

			//- Play human
			this.board.move(this.moves[this.moveId]);
			human = this.board.fen();

			//- Compare the two positions, while we can't compare the moves
			if (ai == human)
			{
				if (this.board.turn() == 'b')	// The move is played already
					this.white++;
				else
					this.black++;
			}
			this.nextMove();
		}
	};
	SF.nextMove();
	return true;
}

function chess_stop()
{
	if (SF == null)
		alert('The analysis is not running.');
	else
		SF.stop = true;
	return (SF != null);
}

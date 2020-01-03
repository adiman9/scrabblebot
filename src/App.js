import React, { useRef, useEffect, useState } from 'react';
import board from 'scrabble-board';
import axios from 'axios';
import Combinatorics from 'js-combinatorics';

const TILE_POINTS = {
  b: 3,
  c: 3,
  d: 2,
  f: 4,
  g: 2,
  h: 4,
  j: 8,
  k: 5,
  m: 3,
  p: 3,
  q: 10,
  v: 4,
  w: 4,
  x: 8,
  y: 4,
  z: 10,
};

// TODO add support for blank tiles Sat 28 Dec 23:58:02 2019

class ScrabbleBoard {
  constructor() {
    this.board = Array(15).fill(null).map(v => Array(15).fill(''));
    this.currentTurn = null;
    this.getDictionary();
  }

  solve(tiles, cb) {
    const playerTiles = tiles.split('');
    let maxScore = 0;
    let bestMove = null;

    for (let row = 0; row < 15; row++) {
      const direction = 'across';
      const rowTiles = this.getLettersFromRow(row);
      const usefulTiles = rowTiles.concat(playerTiles);
      const cmb = Combinatorics.permutationCombination(usefulTiles).toArray()
        .filter(wordArray => {
          if (wordArray.length === 1 && wordArray[0].length > 1) {
            return false;
          }
          const word = wordArray.join('');
          return !!this.dictionary.words[word];
        });
      
      for (let column = 0; column < 15; column++) {
        const executedWords = {};
        for (let wordArray of cmb) {
          const word = wordArray.join('');

          let score = 0;
          let playerTilesCopy = [...playerTiles];
          let numPlayerTiles = playerTilesCopy.length;

          if (executedWords[word]) {
            continue;
          }
          executedWords[word] = 1;
          let letters = word.split('');

          let valid = true;
          for (let i = 0; i < letters.length; i++) {
            const letter = letters[i];
            const currentColumn = column + i;
            if (currentColumn < 15) {
              const currentLetter = this.board[row][currentColumn];

              if (currentLetter !== "" && currentLetter !== letter) {
                // invalid word
                valid = false;
                break;
              } else if (currentLetter === "") {
                const index = playerTilesCopy.indexOf(letter);

                if (index === -1) {
                  // invalid word
                  valid = false;
                  break;
                } else {
                  playerTilesCopy.splice(index, 1);
                }
              }
            } else {
              valid = false;
              break;
            }
          } // end of for loop


          if (valid && playerTilesCopy.length < numPlayerTiles) {
            let wordArgs = {
              word,
              coord: {
                row,
                column,
              },
              direction,
            }
            score = this.calculateScore(wordArgs, true, playerTiles.length);

            if (score !== false && score > maxScore) {
              bestMove = wordArgs;
              console.log(bestMove.word, bestMove.coord, bestMove.direction);
              maxScore = score;
            }
          }
        }
      }
    }

    for (let column = 0; column < 15; column++) {
      const direction = 'down';
      const columnTiles = this.getLettersFromColumn(column);
      const usefulTiles = columnTiles.concat(playerTiles);
      const cmb = Combinatorics.permutationCombination(usefulTiles).toArray()
        .filter(wordArray => {
          const word = wordArray.join('');
          return !!this.dictionary.words[word];
        });

      for (let row = 0; row < 15; row++) {
        const executedWords = {};
        for (let wordArray of cmb) {
          const word = wordArray.join('');

          let score = 0;
          let playerTilesCopy = [...playerTiles];

          if (executedWords[word]) {
            continue;
          }
          executedWords[word] = 1;
          let letters = word.split('');

          let valid = true;

          for (let i = 0; i < letters.length; i++) {
            const letter = letters[i];
            const currentRow = row + i;
            if (currentRow < 15) {
              const currentLetter = this.board[currentRow][column];

              if (currentLetter !== "" && currentLetter !== letter) {
                // invalid word
                valid = false;
                break;
              } else if (currentLetter === "") {
                const index = playerTilesCopy.indexOf(letter);

                if (index === -1) {
                  // invalid word
                  valid = false;
                  break;
                } else {
                  playerTilesCopy.splice(index, 1);
                }
              }
            } else {
              valid = false;
              break;
            }
          } // end of for loop

          if (valid) {
            let wordArgs = {
              word,
              coord: {
                row,
                column,
              },
              direction,
            }
            score = this.calculateScore(wordArgs, true, playerTiles.length);

            if (score !== false && score > maxScore) {
              bestMove = wordArgs;
              maxScore = score;
            }
          }
        }
      }
    }

    if (!bestMove) {
      console.log('No valid move available');
      return;
    }
    this.addWord(bestMove, playerTiles.length);
    cb();
  }

  getLettersFromRow(row) {
    const letters = [];
    let word = [];
    for (let column = 0; column < 15; column++) {
      let letter = this.board[row][column];
      if (letter !== "") {
        word.push(letter);
      } else if (word.length) {
        letters.push(word.join(''));
        word = [];
      }
    }
    return letters;
  }

  getLettersFromColumn(column) {
    const letters = [];
    let word = [];
    for (let row = 0; row < 15; row++) {
      let letter = this.board[row][column];
      if (letter !== "") {
        word.push(letter);
      } else if (word.length) {
        letters.push(word.join(''));
        word = [];
      }
    }
    return letters;
  }

  getDictionary() {
    axios.get('dictionary.json')
      .then(res => {
        this.prepareDictionary(res.data);
      });
  }

  prepareDictionary(data) {
    this.raw_dictionary = data;

    this.dictionary = data.reduce((agg, word) => {
      agg.words[word] = 1;
      const anagramBase = word.split('').sort().join('');
      if (agg.anagrams[anagramBase]) {
        agg.anagrams[anagramBase].push(word);
      } else {
        agg.anagrams[anagramBase] = [word];
      }
      return agg;
    }, {
      anagrams: {},
      words: {},
    });
    window.dict = this.dictionary;
  }

  map(fn) {
    let arr = []
    let rowCount = 0;
    let columnCount = 0;
    for (let row of this.board) {
      columnCount = 0;
      for (let val of row) {
        let index = `${rowCount}-${columnCount}`;
        let special = board(columnCount, rowCount);
        arr.push(fn(val, index, special));
        columnCount += 1;
      }
      rowCount += 1;
    }
    return arr;
  }
  addWord({ word, coord, direction }, tileCount=7) {
    const letters = word.split('');
    let rowInc = 0;
    let columnInc = 0;

    if (direction === 'across') {
      columnInc = 1;
    } else if (direction === 'down') {
      rowInc = 1;
    }

    let { row, column } = coord;

    const score = this.calculateScore({ word, coord, direction }, true, tileCount);
    if (score !== false) {
      const scoringWord = this.findWord({coord, direction});
      console.log(scoringWord.word, score);
      for (let letter of letters) {
        this.board[row][column] = letter;
        row += rowInc;
        column += columnInc;
      }
    } else {
      console.log('ERROR');
    }
  }
  isValid({ word, coord, direction }) {
    if (!this.dictionary.words[word]) {
      return false;
    }
    const letters = word.split('');
    let rowInc = 0;
    let columnInc = 0;

    if (direction === 'across') {
      columnInc = 1;
    } else if (direction === 'down') {
      rowInc = 1;
    }

    let { row, column } = coord;


    let error = false;
    let connected = false;
    for (let letter of letters) {
      if (this.board[row][column] && this.board[row][column] !== letter) {
        error = true;
        break
      } else if (this.board[row][column] !== "")  {
        connected = true;
      } else {
        if (direction === 'across') {
          if (row > 0 && this.board[row - 1][column] !== "") {
            connected = true;
          } else if (row < 14 && this.board[row + 1][column] !== "") {
            connected = true;
          }
        } else if (direction === 'down') {
          if (column > 0 && this.board[row][column - 1] !== "") {
            connected = true;
          } else if (column < 14 && this.board[row][column + 1] !== "") {
            connected = true;
          }
        }
      }
      if (row === 7 && column === 7) {
        connected = true;
      }
      row += rowInc;
      column += columnInc;
      if (row > this.board.length) {
        error = true;
        break;
      }
      if (column > this.board[0].length) {
        error = true;
        break;
      }
    }
    row -= rowInc;
    column -= columnInc;
    if (direction === 'across') {
      if (column - letters.length > -1 && this.board[row][column - letters.length] !== "") {
        connected = true;
      }
      if (column < 14 && this.board[row][column + 1] !== "") {
        connected = true;
      }
    } else if (direction === 'down') {
      if (row - letters.length > -1 && this.board[row - letters.length][column] !== "") {
        connected = true;
      }
      if (row < 14 && this.board[row + 1][column] !== "") {
        connected = true;
      }
    }
    if (!connected) {
      error = true;
    }
    return !error;
  }
  findWord({coord, direction}) {
    let rowInc = 0;
    let columnInc = 0;

    if (direction === 'across') {
      columnInc = 1;
    } else if (direction === 'down') {
      rowInc = 1;
    }
    let { row, column } = coord;

    let word = []
    while (true) {
      if (direction === 'down' && row === 15) {
        row = 14;
        break;
      } else if (direction === 'across' && column === 15) {
        column = 14;
        break;
      }
      if (this.board[row][column] === "") {
        const currentTurnLetter = this.findCurrentTurnLetter({row, column})
        if (currentTurnLetter === "") {
          break;
        } else {
          word.push(currentTurnLetter);
        }
      } else {
        word.push(this.board[row][column]);
      }

      row += rowInc;
      column += columnInc;
    }
    return {
      word: word.join(""),
      coord,
    }
  }
  findWordFromCenter({ coord, direction }) {
    let rowInc = 0;
    let columnInc = 0;

    if (direction === 'across') {
      columnInc = -1;
    } else if (direction === 'down') {
      rowInc = -1;
    }
    let { row, column } = coord;

    while (true) {
      if (direction === 'down' && row === 0) {
        break;
      } else if (direction === 'across' && column === 0) {
        break;
      }
      if (this.board[row][column] === "") {
        row -= rowInc;
        column -= columnInc;
        break;
      }

      row += rowInc;
      column += columnInc;
    }
    const new_coord = {row, column};
    return this.findWord({ coord: new_coord, direction });
  }
  findCurrentTurnLetter(coord) {
    if (!this.currentTurn) {
      return "";
    }
    const { row, column } = coord;
    const {
      word,
      direction,
      coord: currentTurnCoord,
    } = this.currentTurn;

    if (direction === 'across' && row === currentTurnCoord.row) {
      if (column === currentTurnCoord.column) {
        return word[0];
      } else if (column < currentTurnCoord.column) {
        return "";
      } else {
        // search forward
        const diff = column - currentTurnCoord.column;
        if (diff < word.length) {
          return word[diff];
        } else {
          return "";
        }
      }
    } else if (direction === 'down' && column === currentTurnCoord.column) {
      if (row === currentTurnCoord.row) {
        return word[0];
      } else if (row < currentTurnCoord.row) {
        return "";
      } else {
        // search down
        const diff = row - currentTurnCoord.row;
        if (diff < word.length) {
          return word[diff];
        } else {
          return "";
        }
      }
    } else {
      return "";
    }
  }
  calculateScore({ word, coord, direction }, isCurrentTurn=false, tileCount=7) {
    if (isCurrentTurn) {
      this.currentTurn = {
        word,
        coord,
        direction,
      };
    }

    let letters = word.split('');
    let rowInc = 0;
    let columnInc = 0;

    if (direction === 'across') {
      columnInc = 1;
    } else if (direction === 'down') {
      rowInc = 1;
    }

    let { row, column } = coord;

    let score = 0;
    let extraScores = 0;
    let wordMultiplier = 1;

    if (direction === 'across') {
      let word_meta = null;
      if (column > 0 && this.board[row][column - 1] !== "") {
        // find word
        const new_coord = {row, column: column - 1};
        word_meta = this.findWordFromCenter({coord: new_coord, direction});
      } else if (column > -1) {
        // check end of word
        word_meta = this.findWord({coord, direction});
      }
      if (word_meta && word_meta.word) {
        letters = word_meta.word.split('');
        row = word_meta.coord.row;
        column = word_meta.coord.column;
      }
    } else if (direction === 'down') {
      let word_meta = null;
      if (row > 0 && this.board[row - 1][column] !== "") {
        // find word
        const new_coord = {row: row - 1, column};
        word_meta = this.findWordFromCenter({coord: new_coord, direction});
      } else if (row > -1) {
        // check end of word
        word_meta = this.findWord({coord, direction});
      }
      if (word_meta && word_meta.word) {
        letters = word_meta.word.split('');
        row = word_meta.coord.row;
        column = word_meta.coord.column;
      }
    }
    if (!this.isValid({ word: letters.join(''), coord: { row, column }, direction })) {
      this.currentTurn = null;
      return false;
    } 

    let usedTileCount = 0;
    for (let letter of letters) {
      let letterMultiplier = 1;
      if (this.board[row][column] === "") {
        if (isCurrentTurn) {
          usedTileCount += 1;
        }
        let special = board(column, row) 
        letterMultiplier = special.LS;
        wordMultiplier = Math.max(wordMultiplier, special.WS);

        if (direction === 'across' && isCurrentTurn) {
          // loop up and down
          const new_direction = 'down';
          let word_meta = null;
          if (row > 0 && this.board[row - 1][column] !== "") {
            // traverse up
            const new_coord = {row: row - 1, column};
            word_meta = this.findWordFromCenter({coord: new_coord, direction: new_direction});
          } else if (row < 14 && this.board[row + 1][column] !== "") {
            // traverse down
            const new_coord = {row, column};
            word_meta = this.findWord({ coord: new_coord, direction: new_direction });
          }
          if (word_meta && word_meta.word) {
            const calculatedScore = this.calculateScore({
              ...word_meta,
              direction: new_direction,
            }, false, tileCount);
            if (calculatedScore !== false) {
              extraScores += calculatedScore;
            } else {
              return false;
            }
          }
        } else if (direction === 'down' && isCurrentTurn) {
          // look left and right
          const new_direction = 'across';
          let word_meta = null;
          if (column > 0 && this.board[row][column - 1] !== "") {
            // traverse left
            const new_coord = {row, column: column - 1};
            word_meta = this.findWordFromCenter({coord: new_coord, direction: new_direction});
          } else if (column < 14 && this.board[row][column + 1] !== "") {
            // traverse right
            const new_coord = {row, column};
            word_meta = this.findWord({ coord: new_coord, direction: new_direction });
          }
          if (word_meta && word_meta.word) {
            const calculatedScore = this.calculateScore({
              ...word_meta,
              direction: new_direction,
            }, false, tileCount);
            if (calculatedScore !== false) {
              extraScores += calculatedScore;
            } else {
              return false;
            }
          }
        }
      }
      score += (TILE_POINTS[letter.toLowerCase()] || 1) * letterMultiplier;
      row += rowInc;
      column += columnInc;
    }
    score *= wordMultiplier;
    if (usedTileCount === tileCount) {
      score += 50;
    } else if (isCurrentTurn && usedTileCount === 0) {
      return false;
    }
    return score + extraScores;
  }
}

function Square({ letter, squareSize, special, active, lastTurn, onClick, ...state }) {
  const width = `${squareSize}px`;
  const [hover, setHover] = useState(false);

  function getBackground() {
    if (active) {
      return 'green';
    }
    if (lastTurn) {
      return '#00ff0055';
    }
    if (letter) {
      return 'yellow';
    } else if (hover) {
      return '#55555555';
    } else if (special.WS === 3) {
      return 'red';
    } else if (special.WS === 2) {
      return 'pink';
    } else if (special.LS === 3) {
      return 'blue';
    } else if (special.LS === 2) {
      return 'orange';
    } else {
      return 'white';
    }
  }

  return (
    <div style={{
        width,
        height: width,
        border: '1px solid black',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: getBackground(),
      }}
      onMouseOver={() => {
        setHover(true);
      }}
      onMouseLeave={() => {
        setHover(false);
      }}
      onClick={() => onClick && onClick()}
    >
      {letter.toUpperCase()}
    </div>
  )
}

function Board() {
  const board = useRef(null);
  const [ready, setReady] = useState(false);
  const [addingWord, setAddingWord] = useState(false);
  const [newWord, setNewWord] = useState('');
  const [direction, setDirection] = useState('across');
  const [tiles, setTiles] = useState('');
  const [_, update] = useState(null);

  useEffect(() => {
    board.current = new ScrabbleBoard();
    setReady(true);
  }, []);

  let squares = [];
  let squareSize = 40

  if (board.current) {
    squares = board.current.map((val, index, special) => {
      const [row, column] = index.split('-').map(v => parseInt(v));
      return (
        <Square
          letter={val}
          key={index}
          squareSize={squareSize}
          special={special}
          active={row === addingWord.row && column === addingWord.column}
          lastTurn={board.current.findCurrentTurnLetter({row, column})}
          onClick={() => {
            setAddingWord({row, column});
          }}
        />
      );
    });
  }

  return (
    <>
      <div style={{height: '80px', display: 'flex'}}>
        <div style={{width: '50%'}}>
          {addingWord && (
            <>
              <input type="text" value={newWord} onChange={(e) => setNewWord(e.target.value)} />
              <div>
                <input
                  type="radio"
                  name="direction"
                  value="across"
                  checked={direction === 'across'}
                  onChange={(e) => {
                    setDirection('across');
                  }}
                /> across<br/>
                <input
                  type="radio"
                  name="direction"
                  value="down"
                  checked={direction === 'down'}
                  onChange={(e) => {
                    setDirection('down');
                  }}
                /> down<br/>
              </div>
              <button onClick={() => {
                board.current.addWord({
                  word: newWord,
                  coord: addingWord,
                  direction,
                }, 7);
                setAddingWord(false);
                setDirection('across');
                setNewWord('');
              }}>
                Add
              </button>
            </>
          )}
        </div>
        <div style={{ width: '50%' }}>
          <input
            type="text"
            placeholder="Letter Tiles"
            value={tiles}
            onChange={e => {
              setTiles(e.target.value.split('').filter(c => {
                return c.match(/[a-z]/i)
              }).join('').slice(0, 7));
            }} 
          />
          <button
            onClick={() => board.current && board.current.solve(tiles, () => {
              update(new Date().getTime());
            })}
          >
            Solve
          </button>
        </div>
      </div>
      <div style={{display: 'flex', flexWrap: 'wrap', width: `${(squareSize + 2) * 15}px`}}>
        {squares}
      </div>
    </>
  );
}

function App() {
  return (
    <div style={{width: '800px', margin: '0 auto', paddingTop: '30px'}}>
      <Board />
    </div>
  );
}

export default App;

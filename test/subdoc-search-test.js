var mongoose = require('mongoose'),
  async = require('async'),
  elasticsearch = require('elasticsearch'),
  config = require('./config'),
  Schema = mongoose.Schema,
  should = require('should'),
  mongoosastic = require('../lib/mongoosastic');

var AuthorSchema = new Schema({
  name: {
    type: String,
    es_indexed: true
  }
});
AuthorSchema.set('versionKey', false);

var BookSchema = new Schema({
  title: {
    type: String,
    es_indexed: true
  },
  authors: [
    {
      type: Schema.Types.ObjectId,
      ref: 'Author',
      es_schema: AuthorSchema,
      es_indexed: true
    }
  ]
});
BookSchema.set('versionKey', false);

BookSchema.plugin(mongoosastic, {
  index: 'es-index',
  esClient: config.getClient(),
  model: function() {
    return mongoose.model('Book');
  }
});

var Book = mongoose.model('Book', BookSchema)
var Author = mongoose.model('Author', AuthorSchema)

describe('Feature: reIndex document if subdocument changed!', function() {
  before(function(done) {
    async.series([
      function(next) {
        mongoose.connect(config.mongoUrl, next);
      },
      function(next) {
        config.deleteIndexIfExists(['es-index'], next);
      },
      function(next) {
        Book.createMapping(next);
      }
    ], done)
  });

  after(function(done) {
    async.parallel([
      function(next) {
        mongoose.disconnect(next);
      },
      function(next) {
        config.deleteIndexIfExists(['es-index'], next);
      }
    ], done)
    
  })

  describe('subdocument configure with es_schema', function() {
    var author, book;

    before(function(done) {
      async.parallel([
        function(next) {
          author = new Author({name: 'author name'});
          author.save(next);
        },
        function(next) {
          book = new Book({title: 'book title'});
          next(null, book, 1);
        }
      ], function(err, results) {
        if (err) {
          return done(err);
        }

        book.authors.push(author);
        book.save();

        book.once('es-indexed', done);
      })
    });

    it('should find subdoc added', function(done) {
      setTimeout(function() {
        Book.search(undefined, function(err, results) {
          results.hits.total.should.eql(1);
          results.hits.hits[0]._source.authors.length.should.eql(1);
          results.hits.hits[0]._source.authors[0].name.should.eql('author name');

          done()
        })
      }, 1000)
    });

    it('should find more subdocs after add anthor subdocument', function(done) {

      var another = new Author({name: 'newname'});

      async.series([
        function(next) {
            another.save(next);
        },
        function(next) {
          book.authors.push(another);
          book.save(next)
        }
      ], function(err) {
        if (err) {
          return done(err);
        }

        setTimeout(function() {
          Book.search(undefined, function(err, results) {
            results.hits.total.should.eql(1);
            results.hits.hits[0]._source.authors.length.should.eql(2);
            results.hits.hits[0]._source.authors[1].name.should.eql('newname');

            done()
          });
        }, 1000)

      });
    });
  });

});

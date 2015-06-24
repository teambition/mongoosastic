var mongoose = require('mongoose'),
  async = require('async'),
  elasticsearch = require('elasticsearch'),
  config = require('./config'),
  Schema = mongoose.Schema,
  should = require('should'),
  mongoosastic = require('../lib/mongoosastic');

var AuthorSchema = new Schema({
  name: {type: String, es_indexed: true}
})

var BookSchema = new Schema({
  title: {type: String, es_indexed: true},
  author_id: {type: Schema.Types.ObjectId, ref: 'Author', es_schema: AuthorSchema, es_indexed: true},
  authors_ids: [
    {type: Schema.Types.ObjectId, ref: 'Author', es_schema: AuthorSchema, es_indexed: true}
  ]
})

BookSchema.plugin(mongoosastic, {
  index: 'es-index',
  esClient: config.getClient(),
  model: function() {
    return mongoose.model('Book');
  }
});

var Book = mongoose.model('Book', BookSchema)
var Author = mongoose.model('Author', AuthorSchema)

describe('Subdoc configure with es_schema', function() {
  before(function(done) {
    mongoose.connect(config.mongoUrl, function() {
      Book.remove(function() {
        Author.remove(function() {
          config.deleteIndexIfExists(['es-index'], function() {
            var author = new Author({name: 'author name'});

            var book = new Book({title: 'book title'});
            book.author_id = author;

            author.save(function() {
              book.save(function() {
                setTimeout(done, 2000);
              });
            })
          });
        })
      });
    });
  });

  after(function() {
    mongoose.disconnect();
  });

  it('should not find subdoc', function(done) {
    Book.search(undefined, function(err, results) {
      results.hits.total.should.eql(1);
      results.hits.hits[0]._source.author_id.name.should.eql('author name');

      done()
    })
  });
});



describe('Subdoc Array configure with es_schema', function() {
  before(function(done) {
    mongoose.connect(config.mongoUrl, function() {
      Book.remove(function() {
        Author.remove(function() {
          config.deleteIndexIfExists(['es-index'], function() {
            var author = new Author({name: 'author name'});

            var book = new Book({title: 'book title'});
            book.authors_ids.push(author);

            author.save(function() {
              book.save(function() {
                setTimeout(done, 2000);
              });
            })
          });
        })
      });
    });
  });

  after(function() {
    mongoose.disconnect();
  });

  it('should not find subdoc', function(done) {
    Book.search(undefined, function(err, results) {
      results.hits.total.should.eql(1);
      results.hits.hits[0]._source.authors_ids[0].name.should.eql('author name');

      done()
    })
  });
});

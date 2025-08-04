// File: library-system/models/Book.js
const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Book = sequelize.define('Book', {
  id: {
    type: DataTypes.INTEGER,
    primaryKey: true,
    autoIncrement: true
  },
  rfidTag: {
    type: DataTypes.STRING,
    allowNull: false,
    unique: true,
    comment: 'RFID tag UID từ ESP32 cho sách'
  },
  title: {
    type: DataTypes.STRING,
    allowNull: false
  },
  author: {
    type: DataTypes.STRING,
    allowNull: false
  },
  isbn: {
    type: DataTypes.STRING,
    unique: true
  },
  category: {
    type: DataTypes.STRING(100)
  },
  description: {
    type: DataTypes.TEXT
  },
  quantity: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: 0
    }
  },
  available: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
    validate: {
      min: 0
    }
  },
  status: {
    type: DataTypes.ENUM('available', 'maintenance', 'lost', 'damaged'),
    defaultValue: 'available'
  }
}, {
  timestamps: true,
  indexes: [
    {
      unique: true,
      fields: ['rfidTag']
    },
    {
      fields: ['title']
    },
    {
      fields: ['author']
    },
    {
      fields: ['category']
    },
    {
      fields: ['status']
    }
  ]
});

// Hooks để tự động cập nhật available khi quantity thay đổi
Book.addHook('beforeUpdate', (book, options) => {
  if (book.changed('quantity')) {
    // Đảm bảo available không vượt quá quantity
    if (book.available > book.quantity) {
      book.available = book.quantity;
    }
  }
});

// Method để kiểm tra sách có sẵn để mượn không
Book.prototype.isAvailableForLoan = function() {
  return this.status === 'available' && this.available > 0;
};

// Method để mượn sách (giảm available)
Book.prototype.borrowBook = async function() {
  if (!this.isAvailableForLoan()) {
    throw new Error('Sách không có sẵn để mượn');
  }
  
  this.available -= 1;
  await this.save();
  return this;
};

// Method để trả sách (tăng available)
Book.prototype.returnBook = async function() {
  if (this.available >= this.quantity) {
    throw new Error('Không thể trả sách: số lượng đã đủ');
  }
  
  this.available += 1;
  await this.save();
  return this;
};

// Static method để tìm sách bằng RFID tag
Book.findByRfidTag = async function(rfidTag) {
  const book = await this.findOne({
    where: { 
      rfidTag: rfidTag,
      status: 'available'
    }
  });
  
  if (!book) {
    throw new Error(`Không tìm thấy sách với RFID tag: ${rfidTag}`);
  }
  
  return book;
};

// Static method để lấy sách có sẵn
Book.getAvailableBooks = async function() {
  return await this.findAll({
    where: {
      status: 'available',
      available: {
        [sequelize.Sequelize.Op.gt]: 0
      }
    },
    order: [['title', 'ASC']]
  });
};

module.exports = Book;
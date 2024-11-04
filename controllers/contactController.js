const { ObjectId } = require("mongodb");
const sanitizeHtml = require("sanitize-html");
const petsCollection = require("../db").db().collection("pets");
const contactsCollection = require("../db").db().collection("contacts");
const nodemailer = require("nodemailer");
const validator = require("validator");

const sanitizeOptions = {
  allowedTags: [],
  allowedAttributes: {},
};

exports.submitContect = async function (req, res, next) {
  if (req.body.secret.toUpperCase() !== "PUPPY") {
    console.log("Spam detected");
    return res.json({ message: "Sorry!" });
  }

  if (typeof req.body.name !== "string") {
    req.body.name = "";
  }
  if (typeof req.body.email !== "string") {
    req.body.email = "";
  }
  if (typeof req.body.comment !== "string") {
    req.body.comment = "";
  }

  if (!validator.isEmail(req.body.email)) {
    console.log("Invalid email detected");
    return res.json({ message: "Sorry!" });
  }

  if (!ObjectId.isValid(req.body.petId)) {
    console.log("Invalid id detected");
    return res.json({ message: "Sorry!" });
  }

  const doesPetExists = await petsCollection.findOne({
    _id: new ObjectId(req.body.petId),
  });

  if (!doesPetExists) {
    console.log("Pet does not exists.");
    return res.json({ message: "Sorry!" });
  }

  const ourObject = {
    petId: new ObjectId(req.body.petId),
    name: sanitizeHtml(req.body.name, sanitizeOptions),
    email: sanitizeHtml(req.body.email, sanitizeOptions),
    comment: sanitizeHtml(req.body.comment, sanitizeOptions),
  };

  console.log(ourObject);

  // Looking to send emails in production? Check out our Email API/SMTP product!
  const transport = nodemailer.createTransport({
    host: "sandbox.smtp.mailtrap.io",
    port: 2525,
    auth: {
      user: process.env.MAILTRAPUSERNAME,
      pass: process.env.MAILTRAPPASSWORD,
    },
  });

  try {
    const promise1 = transport.sendMail({
      to: ourObject.email,
      from: "petadoption@localhost",
      subject: `Thank you for interest in ${doesPetExists.name}`,
      html: `<h3 style="color:purple; font-size: 30px;font-weight: normal;">Thank you!</h3>
    <p>We appreciate your interest in ${doesPetExists.name} and one of our staff members will reach out to you shortly! Below is a copy of the message you sent us for your personal records:</p>
    <p><em>${ourObject.comment}</em></p>
    `,
    });

    const promise2 = transport.sendMail({
      to: "petadoption@localhost",
      from: "petadoption@localhost",
      subject: `Someone is interested in ${doesPetExists.name}`,
      html: `<h3 style="color:purple; font-size: 30px;font-weight: normal;">New Contact!</h3>
    <p>Name: ${ourObject.name}<br>
    Pet Interested In: ${doesPetExists.name}<br>
    Email: ${ourObject.email}<br>
    Message: ${ourObject.comment}
    </p>
    `,
    });

    const promise3 = await contactsCollection.insertOne(ourObject);

    await Promise.all([promise1, promise2, promise3]);
  } catch (err) {
    next(err);
  }
};

exports.viewPetContacts = async (req, res) => {
  if (!ObjectId.isValid(req.params.id)) {
    console.log("Bad id!");
    return res.redirect("/");
  }
  const pet = await petsCollection.findOne({
    _id: new ObjectId(req.params.id),
  });

  if (!pet) {
    console.log("Pet does not exists!");
    return res.redirect("/");
  }
  const contacts = await contactsCollection
    .find({
      petId: new ObjectId(req.params.id),
    })
    .toArray();

  res.render("pet-contacts", { contacts, pet });
};

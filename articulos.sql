-- phpMyAdmin SQL Dump
-- version 5.2.1
-- https://www.phpmyadmin.net/
--
-- Servidor: 127.0.0.1
-- Tiempo de generación: 23-06-2026 a las 17:06:43
-- Versión del servidor: 10.4.32-MariaDB
-- Versión de PHP: 8.2.12

SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
START TRANSACTION;
SET time_zone = "+00:00";


/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!40101 SET NAMES utf8mb4 */;

--
-- Base de datos: `jjs_fumis`
--

-- --------------------------------------------------------

--
-- Estructura de tabla para la tabla `articulos`
--

CREATE TABLE `articulos` (
  `id` int(11) NOT NULL,
  `rnpud` varchar(50) NOT NULL,
  `nombre` varchar(100) NOT NULL,
  `compo` text NOT NULL,
  `labo` varchar(100) NOT NULL,
  `meto` text NOT NULL,
  `link` varchar(255) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_general_ci;

--
-- Volcado de datos para la tabla `articulos`
--

INSERT INTO `articulos` (`id`, `rnpud`, `nombre`, `compo`, `labo`, `meto`, `link`) VALUES
(1, '0520085', 'MAXFORCE FORTE', 'FIPRONIL 0.05% ', 'BAYER S.A.', 'TAL CUAL FORMULACIÓN\n', 'https://www.ngdesinfecciones.com.ar/docs/MAXFORCE.pdf'),
(2, '0250010', 'PROTEGINAL', 'CIPERMETRINA 20%\r\n', 'CHEMOTECNICA SA', 'ASPERSIÓN', 'https://www.ngdesinfecciones.com.ar/docs/PROTEGINAL.pdf'),
(3, '0250051', 'DECIEN-D', 'PRALETRINA 2.0%\r\nPERMETRINA (80% CIS) 5%\r\nBUTOXIDO DE PIPERONILO 10%\r\n', 'CHEMOTECNICA SA', 'ASPERSIÓN', 'https://www.ngdesinfecciones.com.ar/docs/DECIEN-D.pdf');

--
-- Índices para tablas volcadas
--

--
-- Indices de la tabla `articulos`
--
ALTER TABLE `articulos`
  ADD PRIMARY KEY (`id`);

--
-- AUTO_INCREMENT de las tablas volcadas
--

--
-- AUTO_INCREMENT de la tabla `articulos`
--
ALTER TABLE `articulos`
  MODIFY `id` int(11) NOT NULL AUTO_INCREMENT, AUTO_INCREMENT=4;
COMMIT;

/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;

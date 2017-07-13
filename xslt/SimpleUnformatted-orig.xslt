<?xml version="1.0" encoding="UTF-8" ?>
<xsl:stylesheet version="1.0" xmlns:xsl="http://www.w3.org/1999/XSL/Transform">
  <xsl:output method="xml" omit-xml-declaration="yes"/>
  
  <xsl:template match="/usx">
    <xsl:element name="div">
      <xsl:attribute name="class">usfm</xsl:attribute>
      <!-- set id attribute if no book element - true for Bible modules -->
      <xsl:if test="not(/usx/book)">
        <xsl:attribute name="id">cv1_0</xsl:attribute>
      </xsl:if>
      <xsl:apply-templates/>
    </xsl:element>
  </xsl:template>

  <xsl:template name="openmarker">
    <span class="markerplain">
      <xsl:text>\</xsl:text>
      <!-- Nested character markers need plus -->
      <xsl:if test="self::char and parent::char">
        <xsl:text>+</xsl:text>
      </xsl:if>
      <xsl:value-of select="@style"/>
    </span>
  </xsl:template>

  <xsl:template name="closemarker">
    <xsl:choose>
      <xsl:when test="@closed = 'false'">
      </xsl:when>
      <xsl:otherwise>
        <span class="markerplain">
          <xsl:text>\</xsl:text>
          <!-- Nested character markers need plus -->
          <xsl:if test="self::char and parent::char">
            <xsl:text>+</xsl:text>
          </xsl:if>
          <xsl:value-of select="@style"/>
          <xsl:text>*</xsl:text>
        </span>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="para">
    <span>
      <xsl:call-template name="openmarker"/>
      <xsl:apply-templates/>
    </span>
  </xsl:template>

  <xsl:template match="char">
    <xsl:call-template name="openmarker"/>
    <xsl:apply-templates/>
    <xsl:call-template name="closemarker"/>
  </xsl:template>

  <xsl:template match="book">
    <span id="cv1_0">
      <xsl:call-template name="openmarker"/>
      <xsl:text> </xsl:text>
      <xsl:value-of select="@code"/>
      <xsl:apply-templates/>
    </span>
  </xsl:template>

  <xsl:template match="chapter">
    <!-- Unformatted mode uses "preserve whitespace" so chapter alternate and publishable
    are not attached but are separate tags -->
    <xsl:choose>
      <!-- Chapter 1 verse 0 starts at Id tag -->
      <xsl:when test="@number=1">
        <span>
          <xsl:call-template name="openmarker"/>
          <xsl:text> </xsl:text>
          <xsl:value-of select="@number"/>
        </span>
      </xsl:when>
      <xsl:otherwise>
        <span id="cv{@number}_0">
          <xsl:call-template name="openmarker"/>
          <xsl:text> </xsl:text>
          <xsl:value-of select="@number"/>
        </span>
      </xsl:otherwise>
    </xsl:choose>
    <xsl:apply-templates/>
  </xsl:template>

  <xsl:template match="verse">
    <!-- Unformatted mode uses "preserve whitespace" so verse alternate and publishable
    are not attached but are separate tags -->
    <span id="cv{preceding::chapter[1]/@number}_{@number}">
      <xsl:call-template name="openmarker"/>
      <xsl:text> </xsl:text>
      <xsl:value-of select="@number"/>
      <!-- Add a space after the verse number if it is followed by a CR -->
      <xsl:if test="starts-with(string(following::text()), '&#x0a;')">
        <xsl:text> </xsl:text>
      </xsl:if>
    </span>
    <xsl:apply-templates/>
  </xsl:template>

  <xsl:template match="unmatched">
    <span>
      <xsl:text>\</xsl:text>
      <xsl:value-of select="@marker"/>
    </span>
  </xsl:template>

  <xsl:template match="link">
    <span>
      <xsl:text>\</xsl:text>
      <xsl:value-of select="@style"/>
      <xsl:value-of select="@display"/>
      <xsl:text>|</xsl:text>
      <xsl:value-of select="@target"/>
      <xsl:text>\</xsl:text>
      <xsl:value-of select="@style"/>
      <xsl:text>*</xsl:text>
    </span>
  </xsl:template>

  <xsl:template match="figure">
    <span>
      <xsl:text>\</xsl:text>
      <xsl:value-of select="@style"/>
      <xsl:value-of select="@desc"/>
      <xsl:text>|</xsl:text>
      <xsl:value-of select="@file"/>
      <xsl:text>|</xsl:text>
      <xsl:value-of select="@size"/>
      <xsl:text>|</xsl:text>
      <xsl:value-of select="@loc"/>
      <xsl:text>|</xsl:text>
      <xsl:value-of select="@copy"/>
      <xsl:text>|</xsl:text>
      <xsl:apply-templates/>
      <xsl:text>|</xsl:text>
      <xsl:text>\</xsl:text>
      <xsl:value-of select="@style"/>
      <xsl:text>*</xsl:text>
    </span>
    </xsl:template>

  <xsl:template match="note">
    <xsl:text>\</xsl:text>
    <xsl:value-of select="@style"/>
    <xsl:text> </xsl:text>
    <xsl:value-of select="@caller"/>
    <xsl:if test="@category">
      <xsl:text>\cat </xsl:text>
      <xsl:value-of select="@category"/>
      <xsl:text>\cat*</xsl:text>
    </xsl:if>
    <xsl:apply-templates/>
    <xsl:choose>
      <xsl:when test="@closed = 'false'">
      </xsl:when>
      <xsl:otherwise>
        <xsl:text>\</xsl:text>
        <xsl:value-of select="@style"/>
        <xsl:text>*</xsl:text>
      </xsl:otherwise>
    </xsl:choose>
  </xsl:template>

  <xsl:template match="text()">
    <xsl:value-of select="." disable-output-escaping="yes"/>
  </xsl:template>

  <!-- Table support -->
  <xsl:template match="table">
      <xsl:apply-templates/>
  </xsl:template>

  <xsl:template match="row">
    <span>
      <xsl:call-template name="openmarker"/>
      <xsl:apply-templates/>
    </span>
  </xsl:template>

  <xsl:template match="cell">
    <xsl:call-template name="openmarker"/>
    <xsl:apply-templates/>
  </xsl:template>

  <!-- Sidebar support -->
  <xsl:template match="sidebar">
    <span>
      <xsl:value-of select="concat('\', @style)"/>
      <xsl:if test="@category">
        <xsl:text> \cat </xsl:text>
        <xsl:value-of select="@category"/>
        <xsl:text>\cat*</xsl:text>
      </xsl:if>
    </span>
    <xsl:apply-templates/>
    <xsl:if test="not(@closed = 'false')">
      <span class="markerplain">
        <xsl:value-of select="concat('\', @style, 'e')"/>
      </span>
    </xsl:if>
  </xsl:template>

  <xsl:template match="optbreak">
    <xsl:text>//</xsl:text>
  </xsl:template>
</xsl:stylesheet>
